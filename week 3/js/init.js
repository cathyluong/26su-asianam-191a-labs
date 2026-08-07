const map = new maplibregl.Map({
	container: 'map',
	style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
	center: [-118.2437, 34.0522],
	zoom: 4
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

const themeColors = {
	'Emotional stress': '#d87093',
	'Family separation': '#f29f67',
	'Financial pressure': '#e2c14f',
	'Limited support': '#7fa866',
	'Silence and stigma': '#8f7bc7'
};

function hexToRgba(hexColor, alpha) {
	const normalized = hexColor.replace('#', '');
	const red = parseInt(normalized.slice(0, 2), 16);
	const green = parseInt(normalized.slice(2, 4), 16);
	const blue = parseInt(normalized.slice(4, 6), 16);

	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildPopupContent(properties) {
	return `
		<div class="popup-card">
			<h3>${properties.student}</h3>
			<p class="popup-location">${properties.location_name}, ${properties.state}</p>
			<p><strong>Theme:</strong> ${properties.impact_theme}</p>
			<p>${properties.summary}</p>
		</div>
	`;
}

function addResponsesToPage(features) {
	const responseList = document.getElementById('response-list');

	for (let index = 0; index < features.length; index += 1) {
		const feature = features[index];
		const { properties } = feature;
		const card = document.createElement('details');
		const tagColor = themeColors[properties.impact_theme] || '#d87093';
		const softTagColor = hexToRgba(tagColor, 0.14);

		card.className = 'response-item';
		card.style.borderLeftColor = tagColor;
		card.innerHTML = `
			<summary class="response-summary">
				<div class="response-topline">
					<h3>${properties.student}</h3>
					<span class="response-tag" style="background:${softTagColor}; color:${tagColor}">${properties.impact_theme}</span>
				</div>
				<p class="response-meta">${properties.location_name}, ${properties.state}</p>
			</summary>
			<div class="response-body">
				<p>${properties.summary}</p>
			</div>
		`;

		responseList.appendChild(card);
	}
}

function addPointsToMap(geojson) {
	const bounds = new maplibregl.LngLatBounds();

	for (let index = 0; index < geojson.features.length; index += 1) {
		const feature = geojson.features[index];
		const { coordinates } = feature.geometry;
		const { properties } = feature;
		const markerElement = document.createElement('div');

		markerElement.className = 'legend-swatch';
		markerElement.style.width = '1rem';
		markerElement.style.height = '1rem';
		markerElement.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.85)';
		markerElement.style.background = themeColors[properties.impact_theme] || '#d87093';

		const popup = new maplibregl.Popup({ offset: 18 }).setHTML(buildPopupContent(properties));

		new maplibregl.Marker(markerElement)
			.setLngLat(coordinates)
			.setPopup(popup)
			.addTo(map);

		bounds.extend(coordinates);
	}

	map.fitBounds(bounds, { padding: 50, maxZoom: 5 });
}

fetch('./js/responses.geojson')
	.then((response) => response.json())
	.then((geojson) => {
		addPointsToMap(geojson);
		addResponsesToPage(geojson.features);
	})
	.catch((error) => {
		console.error('Unable to load GeoJSON data:', error);
	});
