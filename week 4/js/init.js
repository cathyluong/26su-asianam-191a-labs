const userProvidedMapStyle = 'https://api.maptiler.com/maps/019fd983-f457-7dba-97c5-07a8dc637a2e/style.json?key=domjvUPbX2qSlWXv88Xn';
const defaultPrimaryMapStyle = 'https://tiles.openfreemap.org/styles/liberty';
const backupMapStyle = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const baseMapStyles = [
	userProvidedMapStyle || defaultPrimaryMapStyle,
	backupMapStyle
];

let map = new maplibregl.Map({
	container: 'map',
	style: baseMapStyles[0],
	center: [-118.2437, 34.0522],
	zoom: 9.3
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

const statusText = document.getElementById('status-text');
const tierFilterButtons = Array.from(document.querySelectorAll('[data-tier-filter]'));

const formResponseSheetUrls = [
	'https://docs.google.com/spreadsheets/d/e/2PACX-1vQJtwXRpSYKZW7x1ADt1rOghMmoua6lLcywG140jSoSgpmjJUoOoy9noZR5UTS5-LUkcPWud3UZUQrh/pub?output=csv',
	'https://docs.google.com/spreadsheets/d/1IbEogcWVaEV0hF1STa83jY0_yxfGr3urCXxs-xyPKzY/gviz/tq?tqx=out:csv&gid=0'
];
const defaultCenter = { lat: 34.0522, lng: -118.2437 };
const geocodeCache = new Map();
const markerInstances = [];

let allResponses = [];
let activeTierFilter = 'all';

function readCssVar(name, fallback) {
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return value || fallback;
}

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
	if (statusText) {
		statusText.textContent = 'Using backup basemap style.';
	}
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

function formatAmenities(rawValue) {
	return String(rawValue || '')
		.split(',')
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function studyabilityTier(rating) {
	if (rating !== null && rating >= 8) {
		return 'top';
	}

	if (rating !== null && rating >= 5) {
		return 'mid';
	}

	return 'low';
}

function tierMeta(tier) {
	if (tier === 'top') {
		return {
			label: '8 to 10',
			color: '#f866b2',
			bg: 'rgba(248, 102, 178, 0.18)'
		};
	}

	if (tier === 'mid') {
		return {
			label: '5 to 7',
			color: '#ff97c8',
			bg: 'rgba(255, 151, 200, 0.18)'
		};
	}

	return {
		label: '1 to 4',
		color: '#ffc2df',
		bg: 'rgba(255, 194, 223, 0.22)'
	};
}

function responseMatchesFilter(response, tierFilter) {
	return tierFilter === 'all' || response.studyabilityTier === tierFilter;
}

function markerElement(color) {
	const marker = document.createElement('div');
	marker.className = 'custom-marker';
	marker.style.width = '0.95rem';
	marker.style.height = '0.95rem';
	marker.style.borderRadius = '50%';
	marker.style.background = color;
	marker.style.border = '2px solid rgba(255,255,255,0.95)';
	marker.style.boxShadow = '0 0 0 1px rgba(42, 72, 49, 0.2), 0 4px 10px rgba(42, 72, 49, 0.3)';
	return marker;
}

function popupNode(response) {
	const tier = tierMeta(response.studyabilityTier);
	const popup = document.createElement('div');
	popup.className = 'popup-card';
	popup.innerHTML = `
		<div class="popup-kicker">study spot pick</div>
		<h3>${escapeHtml(response.spotName)}</h3>
		<p class="popup-area">${escapeHtml(response.area || 'LA/OC area')}</p>
		<div class="popup-scores">
			<span class="popup-score-pill" style="background:${tier.bg}; color:${tier.color};">Studyability tier ${tier.label}</span>
		</div>
		<ul class="popup-list">
			<li><strong>Overall rating:</strong> ${response.overallRating !== null ? `${response.overallRating}/10` : 'Not provided'}</li>
			<li><strong>Studyability rating:</strong> ${response.studyabilityRating !== null ? `${response.studyabilityRating}/10` : 'Not provided'}</li>
			<li><strong>Has:</strong> ${escapeHtml(response.amenities.length ? response.amenities.join(', ') : 'No amenities listed')}</li>
		</ul>
		<p class="popup-note"><strong>What makes this cafe different?</strong> ${escapeHtml(response.why || 'No extra note was shared for this cafe.')}</p>
	`;
	return popup;
}

function addResponsesToMap(responses) {
	for (let i = 0; i < markerInstances.length; i += 1) {
		markerInstances[i].remove();
	}
	markerInstances.length = 0;

	const bounds = new maplibregl.LngLatBounds();

	for (let i = 0; i < responses.length; i += 1) {
		const response = responses[i];
		const markerColor = tierMeta(response.studyabilityTier).color;

		const marker = markerElement(markerColor);
		const popup = new maplibregl.Popup({ offset: 18 }).setDOMContent(popupNode(response));

		const markerInstance = new maplibregl.Marker({ element: marker })
			.setLngLat([response.lng, response.lat])
			.setPopup(popup)
			.addTo(map);

		markerInstances.push(markerInstance);

		bounds.extend([response.lng, response.lat]);
	}

	if (!bounds.isEmpty()) {
		map.fitBounds(bounds, { padding: 55, maxZoom: 13, duration: 900 });
	}
}

function renderResponses() {
	const filteredResponses = allResponses.filter((response) => responseMatchesFilter(response, activeTierFilter));

	addResponsesToMap(filteredResponses);

	if (statusText) {
		const filterLabel = activeTierFilter === 'all' ? 'all tiers' : `tier ${tierMeta(activeTierFilter).label}`;
		statusText.textContent = `Showing ${filteredResponses.length} study spot response${filteredResponses.length === 1 ? '' : 's'} for ${filterLabel}.`;
	}
}

function setupInteractions() {
	tierFilterButtons.forEach((button) => {
		button.addEventListener('click', () => {
			activeTierFilter = button.dataset.tierFilter || 'all';
			tierFilterButtons.forEach((item) => {
				item.classList.toggle('is-active', item === button);
			});
			renderResponses();
		});
	});
}

async function convertRowsToResponses(rows) {
	const parsedResponses = [];

	for (let i = 0; i < rows.length; i += 1) {
		const row = rows[i];
		const lookup = buildLookup(row);

		let lat = parseCoordinate(pickValue(lookup, ['latitude', 'lat', 'y', 'coordinateslat', 'locationlat']));
		let lng = parseCoordinate(pickValue(lookup, ['longitude', 'lng', 'lon', 'long', 'longtitude', 'longtitute', 'x', 'coordinateslng', 'locationlng']));

		const spotName = pickValue(lookup, ['what is the name of this cafe', 'untitled question', 'what is your favorite study cafe', 'favorite study cafe', 'favorite study spot', 'study spot', 'spot name', 'location name', 'cafe name', 'favorite spot']) || 'Unnamed Study Spot';
		const area = pickValue(lookup, ['what area is this cafe located in', 'city', 'neighborhood', 'area', 'county', 'location']) || '';
		const amenitiesRaw = pickValue(lookup, ['which of these does the cafe have', 'amenities', 'features']) || '';
		const overallRating = parseRating(pickValue(lookup, ['how would you rate this cafe overall', 'overall rating', 'rating']));
		const studyabilityRating = parseRating(pickValue(lookup, ['how would you rate the studyability of this cafe', 'studyability', 'study rating']));
		const why = pickValue(lookup, ['what makes this cafe different from others that you ve frequented', 'what makes this cafe different from others that you\'ve frequented', 'what makes this cafe different from others that you prefer it most', 'why this spot', 'why', 'notes', 'description']);
		const timestamp = pickValue(lookup, ['timestamp']);

		if (lat === null || lng === null) {
			const areaCoords = await geocodeArea(area);
			const baseCoords = areaCoords || defaultCenter;
			const jittered = jitterCoordinates(baseCoords, `${spotName}-${area}-${i}`);
			lat = jittered.lat;
			lng = jittered.lng;
		}

		const amenities = formatAmenities(amenitiesRaw);
		const tier = studyabilityTier(studyabilityRating);
		const id = `${timestamp || 'response'}-${i}-${spotName}`;

		parsedResponses.push({
			id,
			lat,
			lng,
			spotName,
			area,
			amenities,
			overallRating,
			studyabilityRating,
			studyabilityTier: tier,
			why,
			timestamp
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

async function loadRowsWithFallback(urls, timeoutMs) {
	let lastError = null;

	for (let i = 0; i < urls.length; i += 1) {
		try {
			const rows = await parseSheetWithTimeout(urls[i], timeoutMs);
			if (Array.isArray(rows) && rows.length > 0) {
				return rows;
			}
		} catch (error) {
			lastError = error;
		}
	}

	if (lastError) {
		throw lastError;
	}

	return [];
}

async function loadResponses() {
	let rows = null;

	try {
		rows = await loadRowsWithFallback(formResponseSheetUrls, 7000);
	} catch (error) {
		if (statusText) {
			statusText.textContent = 'Could not load Google Form responses. Set sheet access to Anyone with the link (Viewer) or publish as CSV.';
		}
		console.error('Google Form response loading failed:', error);
		return;
	}

	const responses = await convertRowsToResponses(rows);

	if (!responses.length) {
		if (statusText) {
			statusText.textContent = 'No survey responses yet. Submit the form to add your first study cafe to the map.';
		}
		return;
	}

	allResponses = responses;
	renderResponses();
}

setupInteractions();
loadResponses();
