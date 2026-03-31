// ── visitors-map.js — Map, stats, and recent visits for visitors.html ──
// Requires: Leaflet, Firebase (initialised by track.js)

(function () {
    var db = firebase.database();

    // ── DOM elements ──
    var uniqueEl  = document.getElementById('visitor-unique');
    var totalEl   = document.getElementById('visitor-total');
    var locationEl = document.getElementById('visitor-location');

    // ── Leaflet map ──
    var map = L.map('visitor-map', {
        worldCopyJump: true,
        zoomControl: true,
        attributionControl: true
    }).setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 8,
        minZoom: 2,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // ── Stat counters ──
    function loadTotalLocations() {
        db.ref('visitors').once('value').then(function (snap) {
            var data = snap.val();
            totalEl.textContent = data ? Object.keys(data).length : '0';
        }).catch(function () { totalEl.textContent = '—'; });
    }

    function loadUniqueVisitors() {
        db.ref('unique_visitors').once('value').then(function (snap) {
            var data = snap.val();
            uniqueEl.textContent = data ? Object.keys(data).length : '0';
        }).catch(function () { uniqueEl.textContent = '—'; });
    }

    // ── Map dots ──
    function addDot(lat, lng, label, isCurrent) {
        L.circleMarker([lat, lng], {
            radius:      isCurrent ? 7 : 5,
            color:       '#800020',
            weight:      isCurrent ? 2.5 : 1,
            fillColor:   isCurrent ? '#f1c6cf' : '#800020',
            fillOpacity: isCurrent ? 0.95 : 0.45
        }).addTo(map).bindPopup('<strong>' + label + '</strong>');
    }

    function loadAllDots() {
        db.ref('visitors').once('value').then(function (snap) {
            var data = snap.val();
            if (!data) return;
            Object.values(data).forEach(function (v) {
                if (v.lat && v.lng) {
                    var label = [v.city, v.country].filter(Boolean).join(', ') || 'Unknown';
                    addDot(v.lat, v.lng, label, false);
                }
            });
        });
    }

    // ── Current visitor location (for map highlight + stat card) ──
    // Stores the current visitor's grid key so we can highlight them in recent visits
    var currentVisitorKey = null;

    async function detectCurrentVisitor() {
        var providers = [
            function () {
                return fetch('https://ipwho.is/').then(function (r) { return r.json(); })
                    .then(function (d) { if (!d.success) throw 0; return { lat: d.latitude, lon: d.longitude, city: d.city, country: d.country }; });
            },
            function () {
                return fetch('https://ipapi.co/json/').then(function (r) { return r.json(); })
                    .then(function (d) { if (d.error) throw 0; return { lat: d.latitude, lon: d.longitude, city: d.city, country: d.country_name }; });
            },
            function () {
                return fetch('https://freeipapi.com/api/json/').then(function (r) { return r.json(); })
                    .then(function (d) { if (!d.latitude) throw 0; return { lat: d.latitude, lon: d.longitude, city: d.cityName, country: d.countryName }; });
            }
        ];

        for (var i = 0; i < providers.length; i++) {
            try {
                var geo = await providers[i]();
                var lat = Number(geo.lat);
                var lng = Number(geo.lon);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

                currentVisitorKey = Math.round(lat * 100) + '_' + Math.round(lng * 100);
                var label = [geo.city, geo.country].filter(Boolean).join(', ');
                locationEl.textContent = label || 'Detected';
                addDot(lat, lng, label + ' (you)', true);
                map.setView([lat, lng], 3, { animate: true });
                return;
            } catch (e) { /* try next */ }
        }

        // Fallback: read most recent Firebase entry
        try {
            var snap = await db.ref('visitors').orderByChild('lastSeen').limitToLast(1).once('value');
            var data = snap.val();
            if (data) {
                var key = Object.keys(data)[0];
                var last = data[key];
                currentVisitorKey = key;
                var label = [last.city, last.country].filter(Boolean).join(', ');
                locationEl.textContent = label || 'Unknown';
                return;
            }
        } catch (e) { /* ignore */ }
        locationEl.textContent = 'Unknown';
    }

    // ── Country helpers ──
    var COUNTRY_CODES = {
        'Afghanistan':'AF','Albania':'AL','Algeria':'DZ','Argentina':'AR','Australia':'AU',
        'Austria':'AT','Bahrain':'BH','Bangladesh':'BD','Belgium':'BE','Brazil':'BR',
        'Cambodia':'KH','Canada':'CA','Chile':'CL','China':'CN','Colombia':'CO',
        'Czech Republic':'CZ','Czechia':'CZ','Denmark':'DK','Egypt':'EG','Ethiopia':'ET',
        'Finland':'FI','France':'FR','Germany':'DE','Ghana':'GH','Greece':'GR',
        'Hong Kong':'HK','Hungary':'HU','India':'IN','Indonesia':'ID','Iran':'IR',
        'Iraq':'IQ','Ireland':'IE','Israel':'IL','Italy':'IT','Japan':'JP','Jordan':'JO',
        'Kenya':'KE','Kuwait':'KW','Laos':'LA','Lebanon':'LB','Libya':'LY',
        'Malaysia':'MY','Mexico':'MX','Mongolia':'MN','Morocco':'MA','Myanmar':'MM',
        'Nepal':'NP','Netherlands':'NL','New Zealand':'NZ','Nigeria':'NG','Norway':'NO',
        'Oman':'OM','Pakistan':'PK','Palestine':'PS','Peru':'PE','Philippines':'PH',
        'Poland':'PL','Portugal':'PT','Qatar':'QA','Romania':'RO','Russia':'RU',
        'Saudi Arabia':'SA','Singapore':'SG','South Africa':'ZA','South Korea':'KR',
        'Spain':'ES','Sri Lanka':'LK','Sudan':'SD','Sweden':'SE','Switzerland':'CH',
        'Syria':'SY','Taiwan':'TW','Thailand':'TH','Tunisia':'TN','Turkey':'TR',
        'Türkiye':'TR','Ukraine':'UA','United Arab Emirates':'AE','United Kingdom':'GB',
        'United States':'US','Uzbekistan':'UZ','Vietnam':'VN','Yemen':'YE'
    };

    function flagImg(code) {
        var c = code.toLowerCase();
        return '<img src="https://flagcdn.com/' + c + '.svg" width="20" height="15" alt="' + code + '" style="vertical-align:middle;margin-right:5px;border-radius:2px;">';
    }

    function getFlag(v) {
        var code = v.countryCode || COUNTRY_CODES[v.country] || '';
        return code ? flagImg(code) : '';
    }

    function normalizeOS(os) {
        if (os === 'macOS') return 'macOS/iOS';
        return os || '';
    }

    // ── Recent visits ──
    function loadRecentVisits() {
        var listEl = document.getElementById('recent-visits-list');

        db.ref('visitors').orderByChild('lastSeen').limitToLast(10).once('value').then(function (snap) {
            var raw = snap.val();
            if (!raw) { listEl.innerHTML = '<p class="visitors-note">No visits yet.</p>'; return; }

            // Build array with keys so we can match the current visitor
            var entries = Object.keys(raw).map(function (k) {
                return { key: k, data: raw[k] };
            }).sort(function (a, b) {
                return (b.data.lastSeen || '').localeCompare(a.data.lastSeen || '');
            });

            listEl.innerHTML = '';
            entries.forEach(function (entry) {
                var v = entry.data;
                var isYou = currentVisitorKey && entry.key === currentVisitorKey;
                var flag = getFlag(v);
                var loc  = [v.city, v.country].filter(Boolean).join(', ') || 'Unknown';
                var os   = normalizeOS(v.os);
                var when = new Date(v.lastSeen);
                var timeStr = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    + ' at ' + when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

                var item = document.createElement('div');
                item.className = 'visitors-summary-item' + (isYou ? ' visitors-you' : '');
                item.innerHTML =
                    '<span class="visitors-summary-key">' + flag + loc + '</span>' +
                    '<span class="visitors-summary-value">' + timeStr + (os ? ' · ' + os : '') + '</span>';
                listEl.appendChild(item);
            });
        }).catch(function () {
            listEl.innerHTML = '<p class="visitors-note">Could not load recent visits.</p>';
        });
    }

    // ── Boot ──
    window.addEventListener('load', async function () {
        loadTotalLocations();
        loadUniqueVisitors();
        loadAllDots();
        await detectCurrentVisitor();   // wait so we know currentVisitorKey before rendering list
        loadRecentVisits();
    });
})();
