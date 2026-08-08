const map = new maplibregl.Map({
	container: 'map',
	style: 'https://api.maptiler.com/maps/019fd983-f457-7dba-97c5-07a8dc637a2e/style.json?key=domjvUPbX2qSlWXv88Xn',
	center: [-118.2437, 34.0522],
	zoom: 4
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

const themeColors = {
	'Emotional and psychological distress': '#d87093',
	'Family separation and changed relationships': '#f29f67',
	'Financial strain and increased responsibilities': '#e2c14f',
	'Disruption to education and everyday life': '#7fa866',
	'Fear, stigma, and isolation': '#8f7bc7'
};

function getImpactTheme(properties) {
	return properties.impact_theme || properties.Impact_theme || 'Unknown impact';
}

function hexToRgba(hexColor, alpha) {
	const normalized = hexColor.replace('#', '');
	const red = parseInt(normalized.slice(0, 2), 16);
	const green = parseInt(normalized.slice(2, 4), 16);
	const blue = parseInt(normalized.slice(4, 6), 16);

	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildPopupContent(properties) {
	const impactTheme = getImpactTheme(properties);

	return `
		<div class="popup-card">
			<h3>${properties.student}</h3>
			<p class="popup-location">${properties.location_name}, ${properties.state}</p>
			<p><strong>Aftermath:</strong> ${impactTheme}</p>
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
		const impactTheme = getImpactTheme(properties);
		const tagColor = themeColors[impactTheme] || '#d87093';
		const softTagColor = hexToRgba(tagColor, 0.14);

		card.className = 'response-item';
		card.style.borderLeftColor = tagColor;
		card.innerHTML = `
			<summary class="response-summary">
				<div class="response-topline">
					<h3>${properties.student}</h3>
					<span class="response-tag" style="background:${softTagColor}; color:${tagColor}">${impactTheme}</span>
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
		const impactTheme = getImpactTheme(properties);
		const markerElement = document.createElement('div');

		markerElement.className = 'legend-swatch';
		markerElement.style.width = '1rem';
		markerElement.style.height = '1rem';
		markerElement.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.85)';
		markerElement.style.background = themeColors[impactTheme] || '#d87093';

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
