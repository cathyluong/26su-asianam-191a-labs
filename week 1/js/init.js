// Initialize the map
const map = new maplibregl.Map({
    container: 'map', // Matches <div id="map">
    style: 'https://api.maptiler.com/maps/019fd8ca-107b-7008-ad8a-d9dc87817db6/style.json?key=QKsb7BgF9sHOSThAVJyV',
    center: [-118.4403, 34.0728], // UCLA
    zoom: 12

});

// Pulsating marker
const pulsingDot = {
    width: 100,
    height: 100,
    data: new Uint8Array(100 * 100 * 4),

    onAdd: function () {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        this.context = canvas.getContext('2d');
    },

    render: function () {
        const duration = 1000;
        const t = (performance.now() % duration) / duration;

        const radius = (this.width / 2) * 0.3;
        const outerRadius = (this.width / 2) * 0.7 * t + radius;
        const context = this.context;

        context.clearRect(0, 0, this.width, this.height);
        context.beginPath();
        context.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
        context.fillStyle = `rgba(254, 203, 0, ${1 - t})`;
        context.fill();

        context.beginPath();
        context.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
        context.fillStyle = '#d87093';
        context.strokeStyle = 'white';
        context.lineWidth = 2 + 4 * (1 - t);
        context.fill();
        context.stroke();

        this.data = context.getImageData(0, 0, this.width, this.height).data;

        map.triggerRepaint();

        return true;
    }
};

function showPulsingMarker(coordinates) {
    const source = map.getSource('ucla-pulsing-point');
    if (!source) {
        return;
    }

    source.setData({
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: coordinates
                }
            }
        ]
    });

    map.setLayoutProperty('ucla-pulsing-layer', 'visibility', 'visible');
}

function hidePulsingMarker() {
    if (!map.getLayer('ucla-pulsing-layer')) {
        return;
    }

    map.setLayoutProperty('ucla-pulsing-layer', 'visibility', 'none');
}

function attachPulsingToPopup(popup, coordinates) {
    popup.on('open', () => {
        showPulsingMarker(coordinates);
    });

    popup.on('close', () => {
        hidePulsingMarker();
    });
}

map.on('load', () => {
    // Register the animated image and create a hidden pulse layer.
    map.addImage('pulsing-dot', pulsingDot, { pixelRatio: 2 });
    map.addSource('ucla-pulsing-point', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });

    map.addLayer({
        id: 'ucla-pulsing-layer',
        type: 'symbol',
        source: 'ucla-pulsing-point',
        layout: {
            'icon-image': 'pulsing-dot',
            'icon-allow-overlap': true,
            visibility: 'none'
        }
    });
});

map.on('click', hidePulsingMarker);



// -------------------------
// UCLA Main Campus
// -------------------------
const uclaMarker = new maplibregl.Marker({ color: '#d87093' })
    .setLngLat([-118.4403, 34.0728])
    .setPopup(
        new maplibregl.Popup({ offset: 25 })
            .setHTML(`
                <h3>UCLA Main Campus</h3>
                <p>
                    My home for the past few years. Between classes, research,
                    and countless study sessions, this campus has shaped my
                    undergraduate experience.
                </p>
            `)
    )
    .addTo(map);
attachPulsingToPopup(uclaMarker.getPopup(), [-118.4403, 34.0728]);

// -------------------------
// About Time Cafe
// -------------------------

const aboutTimeMarker = new maplibregl.Marker({ color: '#d87093' })
    .setLngLat([-118.293827, 34.061963])
    .setPopup(
        new maplibregl.Popup({ offset: 25 })
            .setHTML(`
                <h2>☕ About Time</h2>
                <h4> Location: 3287 Wilshire Blvd B Los Angeles, CA 90010 </h4>
                <p><strong>⭐ My Rating:</strong> 3.0/5</p>
                <p><strong>☕ Best for:</strong> Late-night studying and all-day study sessions</p>
                <p><strong>🔌 Outlets:</strong> Honestly not a lot. The few ones that exist are always being used.</p>
                <p><strong>🕐 Hours:</strong> 8:00 AM - 1:00 AM</p>

                <hr>

                <p>
                   The first café where I studied in Los Angeles! It's spacious
                    and aesthetic, although seating and outlets can be limited.
                    Since it's open until 1 AM, it became one of my favorite
                    places for late-night study sessions or all-day grinds.
                    There's a one-drink-per-person policy, but that is the sacrifice one must make
                    in order to find a spot to study in peace. The staff could improve though.
                </p>
            `)
    )
    .addTo(map);
attachPulsingToPopup(aboutTimeMarker.getPopup(), [-118.293827, 34.061963]);

// -------------------------
// Young Research Library
// -------------------------
const yrlMarker = new maplibregl.Marker({ color: '#d87093' })
    .setLngLat([-118.441472, 34.075000])
    .setPopup(
        new maplibregl.Popup({ offset: 25 })
            .setHTML(`
                <h3>Young Research Library (YRL)</h3>
                <p><strong>⭐ My Rating:</strong> 4.0/5</p>
                <p><strong> Best for:</strong> Full-focused grind sessions</p>
                <p><strong>🕐 Hours:</strong> 8:00AM - 10:00 PM</p>

                <hr>
                <p>
                    One of my favorite places to study at UCLA! It's spacious,
                    quiet, and has plenty of seating. The higher floors are even
                    quieter, making them perfect for long study sessions before
                    midterms and finals. The library staff are also incredibly
                    kind and helpful. One negative is it can get pretty musty in here & I'm
                    pretty sure there's no AC....
                </p>
            `)
    )
    .addTo(map);
attachPulsingToPopup(yrlMarker.getPopup(), [-118.441472, 34.075000]);

// -------------------------
// Powell Library
// -----------------------
const powellMarker = new maplibregl.Marker({ color: '#d87093' })
    .setLngLat([-118.44224097749326, 34.071782066631464])
    .setPopup(
        new maplibregl.Popup({ offset: 25 })
            .setHTML(`
                <h3>Powell Library</h3>
                <p><strong>⭐ My Rating:</strong> 3.5/5</p>
                <p><strong> Best for:</strong> Full-focused grind sessions, scenic studying, after-class studying, 
                all-nighters, late-night grind sessions, late-night studying</p>
                 <p><strong>🕐 Hours:</strong> 8:00 AM - 10:00PM with Night Powell as afterhours</p>

                <hr>
                <p>
                    Obviously, the main library is a classic and must-visit for any UCLA student.
                    Now that the Reading Room is open again, it literally looks like a scene from Hogwarts.
                    Bonus is Night Powell which is the place to go when you need to grind like a chud. It is SUPER
                    musty in here though and with no AC or even ventiliation it seems, this can be a pretty far from ideal
                    environment to grind in during exam season.
                </p>
            `)
    )
    .addTo(map);
attachPulsingToPopup(powellMarker.getPopup(), [-118.44224097749326, 34.071782066631464]);

// -------------------------
// Biomedical Library
// -----------------------
const biomedMarker = new maplibregl.Marker({ color: '#d87093' })
    .setLngLat([-118.44185, 34.06632])
    .setPopup(
        new maplibregl.Popup({ offset: 25 })
            .setHTML(`
                <h3>Louise M. Darling Biomedical Library</h3>
                 <p><strong>⭐ My Rating:</strong> 5.0/5</p>
                <p><strong> Best for:</strong> Full-focused grind sessions, using the dental and medical students
                as motivation, all-day study sessions, after-class studying</p>
                <p><strong>🕐 Hours:</strong> 8:00 AM - 10:00 PM</p>
                <hr>
                <p>
                    As someone who has tried to be very studious all throughout undergrad, 
                    Biomed offers whiteboards and spacious tables with countless outlets and multiple floors of quiet study spaces.
                    I wish they stayed open late at night but they close at 10 PM on most days. Does get crowded during exam season but I still
                    manage to find a spot to study in spite of that.
                </p>
            `)
    )
    .addTo(map);
attachPulsingToPopup(biomedMarker.getPopup(), [-118.44185, 34.06632]);
