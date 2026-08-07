const baseMapStyles = [
	'https://tiles.openfreemap.org/styles/liberty',
	'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
];

let map = new maplibregl.Map({
	container: 'map',
	style: baseMapStyles[0],
	center: [-118.2437, 34.0522],
	zoom: 9.3
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

const statusText = document.getElementById('status-text');
const responseList = document.getElementById('response-list');

const formResponseSheetUrl = 'https://docs.google.com/spreadsheets/d/1IbEogcWVaEV0hF1STa83jY0_yxfGr3urCXxs-xyPKzY/gviz/tq?tqx=out:csv&gid=0';
const defaultCenter = { lat: 34.0522, lng: -118.2437 };
const geocodeCache = new Map();

function readCssVar(name, fallback) {
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return value || fallback;
}

const vibeStyles = {
	'Focus Zone': { color: readCssVar('--vibe-focus', '#94c8ad'), bg: 'rgba(148, 200, 173, 0.2)' },
	'Social Buzz': { color: readCssVar('--vibe-social', '#f6d98d'), bg: 'rgba(246, 217, 141, 0.24)' },
	'Fresh Air': { color: readCssVar('--vibe-fresh', '#86b6e4'), bg: 'rgba(134, 182, 228, 0.2)' },
	'Cozy Corner': { color: readCssVar('--vibe-cozy', '#db6b9f'), bg: 'rgba(219, 107, 159, 0.2)' }
};

let triedStyleFallback = false;

map.on('error', (event) => {
	if (triedStyleFallback) {
		return;
	}

	const message = String(event?.error?.message || '').toLowerCase();
	const shouldFallback = message.includes('failed to fetch') || message.includes('403') || message.includes('401');

	if (!shouldFallback) {
		return;
	}

	triedStyleFallback = true;
	map.setStyle(baseMapStyles[1]);
	statusText.textContent = 'Using backup basemap style.';
});

function normalizeKey(key) {
	return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildLookup(row) {
	const lookup = {};
	const keys = Object.keys(row);
	for (let i = 0; i < keys.length; i += 1) {
		lookup[normalizeKey(keys[i])] = row[keys[i]];
	}
	return lookup;
}

function pickValue(lookup, candidates) {
	for (let i = 0; i < candidates.length; i += 1) {
		const normalizedCandidate = normalizeKey(candidates[i]);
		if (lookup[normalizedCandidate] !== undefined && lookup[normalizedCandidate] !== '') {
			return String(lookup[normalizedCandidate]).trim();
		}
	}
	return '';
}

function parseCoordinate(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseRating(value) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return null;
	}
	return parsed;
}

function normalizeAreaText(value) {
	return String(value || '')
		.toLowerCase()
		.replace(/[^a-z0-9 ]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function hashSeed(text) {
	let hash = 0;
	for (let i = 0; i < text.length; i += 1) {
		hash = ((hash << 5) - hash) + text.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}

function jitterCoordinates(base, seedText) {
	const seed = hashSeed(seedText || 'study-cafe');
	const jitterLat = ((seed % 1200) / 1200 - 0.5) * 0.06;
	const jitterLng = (((Math.floor(seed / 1200)) % 1200) / 1200 - 0.5) * 0.08;
	return {
		lat: base.lat + jitterLat,
		lng: base.lng + jitterLng
	};
}

function findPresetCoordinates(areaText) {
	const normalized = normalizeAreaText(areaText);
	const presets = [
		{ key: /beverly hills/, lat: 34.0736, lng: -118.4004 },
		{ key: /korea ?town|k town|ktown/, lat: 34.0626, lng: -118.308 },
		{ key: /westwood|ucla/, lat: 34.0635, lng: -118.4455 },
		{ key: /usc|university park/, lat: 34.0224, lng: -118.2851 },
		{ key: /santa monica/, lat: 34.0195, lng: -118.4912 },
		{ key: /pasadena/, lat: 34.1478, lng: -118.1445 },
		{ key: /glendale/, lat: 34.1425, lng: -118.2551 },
		{ key: /culver city/, lat: 34.0211, lng: -118.3965 },
		{ key: /irvine/, lat: 33.6846, lng: -117.8265 },
		{ key: /anaheim/, lat: 33.8366, lng: -117.9143 },
		{ key: /fullerton/, lat: 33.8704, lng: -117.9242 },
		{ key: /tustin/, lat: 33.7459, lng: -117.8262 },
		{ key: /newport beach/, lat: 33.6189, lng: -117.9298 },
		{ key: /garden grove/, lat: 33.7743, lng: -117.9379 },
		{ key: /orange county|\boc\b/, lat: 33.7175, lng: -117.8311 },
		{ key: /los angeles|\bla\b/, lat: 34.0522, lng: -118.2437 }
	];

	for (let i = 0; i < presets.length; i += 1) {
		if (presets[i].key.test(normalized)) {
			return { lat: presets[i].lat, lng: presets[i].lng };
		}
	}

	return null;
}

async function geocodeArea(areaText) {
	const normalized = normalizeAreaText(areaText);
	if (!normalized) {
		return null;
	}

	if (geocodeCache.has(normalized)) {
		return geocodeCache.get(normalized);
	}

	const preset = findPresetCoordinates(areaText);
	if (preset) {
		geocodeCache.set(normalized, preset);
		return preset;
	}

	try {
		const query = encodeURIComponent(`${areaText}, California`);
		const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`);
		if (!response.ok) {
			throw new Error(`Geocoding failed with status ${response.status}`);
		}
		const data = await response.json();
		if (Array.isArray(data) && data.length > 0) {
			const match = {
				lat: Number(data[0].lat),
				lng: Number(data[0].lon)
			};
			if (Number.isFinite(match.lat) && Number.isFinite(match.lng)) {
				geocodeCache.set(normalized, match);
				return match;
			}
		}
	} catch (error) {
		console.warn('Area geocoding failed, using fallback center:', areaText, error);
	}

	return null;
}

function classifyVibe(vibeSourceText) {
	const text = (vibeSourceText || '').toLowerCase();

	if (/quiet|silent|library|lock ?in|focus|study/i.test(text)) {
		return 'Focus Zone';
	}
	if (/busy|social|friends|chat|crowd|music|lively/i.test(text)) {
		return 'Social Buzz';
	}
	if (/outdoor|patio|sun|nature|fresh ?air|garden/i.test(text)) {
		return 'Fresh Air';
	}
	return 'Cozy Corner';
}

function formatAmenities(rawValue) {
	return String(rawValue || '')
		.split(',')
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function markerElement(color) {
	const marker = document.createElement('div');
	marker.style.width = '0.95rem';
	marker.style.height = '0.95rem';
	marker.style.borderRadius = '50%';
	marker.style.background = color;
	marker.style.border = '2px solid rgba(255,255,255,0.95)';
	marker.style.boxShadow = '0 0 0 1px rgba(124,31,72,0.15), 0 4px 10px rgba(124,31,72,0.25)';
	return marker;
}

function popupMarkup(response) {
	const overallText = response.overallRating === null ? 'N/A' : `${response.overallRating}/5`;
	const studyText = response.studyabilityRating === null ? 'N/A' : `${response.studyabilityRating}/10`;
	const amenitiesText = response.amenities.length ? response.amenities.join(', ') : 'No amenities listed';

	return `
		<div class="popup-card">
			<div class="popup-kicker">study spot pick</div>
			<h3>${response.spotName}</h3>
			<p class="popup-note">${response.why || 'No note was shared.'}</p>
			<ul class="popup-meta">
				<li><strong>Area:</strong> ${response.area || 'LA/OC area'}</li>
				<li><strong>Overall:</strong> ${overallText}</li>
				<li><strong>Studyability:</strong> ${studyText}</li>
				<li><strong>Amenities:</strong> ${amenitiesText}</li>
				<li><strong>Vibe:</strong> ${response.vibe}</li>
				<li><strong>Submitted:</strong> ${response.timestamp || 'Unknown time'}</li>
			</ul>
		</div>
	`;
}

function addResponsesToList(responses) {
	responseList.innerHTML = '';

	for (let i = 0; i < responses.length; i += 1) {
		const response = responses[i];
		const style = vibeStyles[response.vibe] || vibeStyles['Cozy Corner'];

		const card = document.createElement('details');
		card.className = 'response-item';
		card.style.borderLeftColor = style.color;
		card.innerHTML = `
			<summary class="response-summary">
				<div class="response-topline">
					<h3>${response.spotName}</h3>
					<span class="response-tag" style="background:${style.bg}; color:${style.color};">${response.vibe}</span>
				</div>
				<p class="response-meta">${response.area || 'LA/OC'} • Overall ${response.overallRating === null ? 'N/A' : `${response.overallRating}/5`} • Studyability ${response.studyabilityRating === null ? 'N/A' : `${response.studyabilityRating}/10`}</p>
			</summary>
			<div class="response-body">
				<p>${response.why || 'No extra note provided.'}</p>
				<p><strong>Amenities:</strong> ${response.amenities.length ? response.amenities.join(', ') : 'No amenities listed.'}</p>
			</div>
		`;

		responseList.appendChild(card);
	}
}

function addResponsesToMap(responses) {
	const bounds = new maplibregl.LngLatBounds();

	for (let i = 0; i < responses.length; i += 1) {
		const response = responses[i];
		const style = vibeStyles[response.vibe] || vibeStyles['Cozy Corner'];
		const marker = markerElement(style.color);
		const popup = new maplibregl.Popup({ offset: 18 }).setHTML(popupMarkup(response));

		new maplibregl.Marker(marker)
			.setLngLat([response.lng, response.lat])
			.setPopup(popup)
			.addTo(map);

		bounds.extend([response.lng, response.lat]);
	}

	if (!bounds.isEmpty()) {
		map.fitBounds(bounds, { padding: 55, maxZoom: 13, duration: 900 });
	}
}

async function convertRowsToResponses(rows) {
	const parsedResponses = [];

	for (let i = 0; i < rows.length; i += 1) {
		const row = rows[i];
		const lookup = buildLookup(row);

		let lat = parseCoordinate(pickValue(lookup, ['latitude', 'lat', 'y', 'coordinateslat', 'locationlat']));
		let lng = parseCoordinate(pickValue(lookup, ['longitude', 'lng', 'lon', 'long', 'longtitude', 'longtitute', 'x', 'coordinateslng', 'locationlng']));

		const spotName = pickValue(lookup, ['untitled question', 'what is your favorite study cafe', 'favorite study cafe', 'favorite study spot', 'study spot', 'spot name', 'location name', 'cafe name', 'favorite spot']) || 'Unnamed Study Spot';
		const area = pickValue(lookup, ['what area is this cafe located in', 'city', 'neighborhood', 'area', 'county', 'location']) || '';
		const amenitiesRaw = pickValue(lookup, ['which of these does the cafe have', 'amenities', 'features']) || '';
		const overallRating = parseRating(pickValue(lookup, ['how would you rate this cafe overall', 'overall rating', 'rating']));
		const studyabilityRating = parseRating(pickValue(lookup, ['how would you rate the studyability of this cafe', 'studyability', 'study rating']));
		const why = pickValue(lookup, ['what makes this cafe different from others that you prefer it most', 'why this spot', 'why', 'notes', 'description']);
		const timestamp = pickValue(lookup, ['timestamp']);

		if (lat === null || lng === null) {
			const areaCoords = await geocodeArea(area);
			const baseCoords = areaCoords || defaultCenter;
			const jittered = jitterCoordinates(baseCoords, `${spotName}-${area}-${i}`);
			lat = jittered.lat;
			lng = jittered.lng;
		}

		const amenities = formatAmenities(amenitiesRaw);
		const vibeSource = [
			amenitiesRaw,
			why,
			spotName,
			area,
			studyabilityRating === null ? '' : `studyability ${studyabilityRating}`
		].join(' ');

		const vibe = classifyVibe(vibeSource);

		parsedResponses.push({
			lat,
			lng,
			spotName,
			area,
			amenities,
			overallRating,
			studyabilityRating,
			why,
			timestamp,
			vibe
		});
	}

	return parsedResponses;
}

function parseSheet(url) {
	return new Promise((resolve, reject) => {
		Papa.parse(url, {
			download: true,
			header: true,
			skipEmptyLines: true,
			complete: (results) => {
				if (!results || !results.data) {
					reject(new Error('No sheet data was returned.'));
					return;
				}
				resolve(results.data);
			},
			error: (error) => reject(error)
		});
	});
}

function parseSheetWithTimeout(url, timeoutMs) {
	return Promise.race([
		parseSheet(url),
		new Promise((_, reject) => {
			setTimeout(() => reject(new Error('Sheet request timed out.')), timeoutMs);
		})
	]);
}

async function loadResponses() {
	let rows = null;

	try {
		rows = await parseSheetWithTimeout(formResponseSheetUrl, 7000);
	} catch (error) {
		statusText.textContent = 'Could not load Google Form responses. Set sheet access to Anyone with the link (Viewer) or publish as CSV.';
		console.error('Google Form response loading failed:', error);
		return;
	}

	const responses = await convertRowsToResponses(rows);

	if (!responses.length) {
		statusText.textContent = 'No survey responses yet. Submit the form to add your first study cafe to the map.';
		responseList.innerHTML = '<p class="response-note">Waiting for survey responses.</p>';
		return;
	}

	statusText.textContent = `Loaded ${responses.length} study spot response${responses.length === 1 ? '' : 's'}.`;
	addResponsesToMap(responses);
	addResponsesToList(responses);
}

loadResponses();
