// Journey map — Riyadh → KAUST → Toronto → Boston
(function() {
    var stops = [
        { name: 'Riyadh', lat: 24.7136, lng: 46.6753, label: 'Riyadh, Saudi Arabia', years: 'Hometown' },
        { name: 'KAUST', lat: 22.3095, lng: 39.1044, label: 'Thuwal, Saudi Arabia', years: 'KAUST (Dec 2023–May 2024)' },
        { name: 'Toronto', lat: 43.6532, lng: -79.3832, label: 'Toronto, Canada', years: 'Vector Institute (May–Aug 2024)' },
        { name: 'Boston', lat: 42.3601, lng: -71.0589, label: 'Boston, USA', years: 'Harvard Medical School (2024–Present)' }
    ];

    var map = L.map('journey-map', {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false,
        dragging: true
    }).setView([32, -10], 3);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 6,
        minZoom: 2,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Draw route line
    var coords = stops.map(function(s) { return [s.lat, s.lng]; });
    L.polyline(coords, {
        color: '#800020',
        weight: 2.5,
        opacity: 0.6,
        dashArray: '8, 8'
    }).addTo(map);

    // Draw numbered stop markers
    stops.forEach(function(s, i) {
        var isLast = i === stops.length - 1;
        var num = i + 1;
        L.circleMarker([s.lat, s.lng], {
            radius: isLast ? 8 : 6,
            color: '#800020',
            weight: isLast ? 3 : 2,
            fillColor: isLast ? '#f1c6cf' : '#800020',
            fillOpacity: isLast ? 0.95 : 0.55
        }).addTo(map).bindPopup(
            '<strong>' + s.label + '</strong><br><em>' + s.years + '</em>'
        );
        L.marker([s.lat, s.lng], {
            icon: L.divIcon({
                className: 'journey-number',
                html: '<span>' + num + '</span>',
                iconSize: [16, 16],
                iconAnchor: [8, 22]
            })
        }).addTo(map);
    });

    // Fit all stops in view
    map.fitBounds(coords, { padding: [40, 40] });
})();
