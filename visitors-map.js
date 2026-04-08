// ── visitors-map.js — Map, stats, and recent visits for visitors.html ──
(function () {
    var db = firebase.database();

    var uniqueEl   = document.getElementById('visitor-unique');
    var totalEl    = document.getElementById('visitor-total');
    var locationEl = document.getElementById('visitor-location');

    var allVisitors = [];
    var currentVisitorKey = null;

    function hashStr(s) {
        for (var h = 5381, i = 0; i < s.length; i++)
            h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
        return h.toString(36);
    }

    function loadVisitors() {
        return db.ref('visitors').once('value').then(function (snap) {
            var data = snap.val();
            allVisitors = [];
            if (data) {
                for (var key in data) {
                    var v = data[key];
                    v.key = key;
                    allVisitors.push(v);
                }
            }
            return allVisitors;
        }).catch(function () {
            allVisitors = [];
            return allVisitors;
        });
    }

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

    // ── Helpers ──
    function addDot(lat, lng, label, isCurrent) {
        L.circleMarker([lat, lng], {
            radius:      isCurrent ? 7 : 5,
            color:       '#800020',
            weight:      isCurrent ? 2.5 : 1,
            fillColor:   isCurrent ? '#f1c6cf' : '#800020',
            fillOpacity: isCurrent ? 0.95 : 0.45
        }).addTo(map).bindPopup('<strong>' + label + '</strong>');
    }

    function buildLabel(v) {
        var parts = [v.city];
        if (v.country === 'United States' && v.region) parts.push(v.region);
        parts.push(v.country);
        return parts.filter(Boolean).join(', ') || 'Unknown';
    }

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
        return '<img src="https://flagcdn.com/' + code.toLowerCase() + '.svg" width="20" height="15" alt="' + code + '" style="vertical-align:middle;margin-right:5px;border-radius:2px;">';
    }

    function getFlag(v) {
        var code = v.countryCode || COUNTRY_CODES[v.country] || '';
        return code ? flagImg(code) : '';
    }

    function buildAnalyticsRows(container, counts) {
        var sorted = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; });
        var max = sorted[0] ? sorted[0][1] : 1;
        container.innerHTML = '';
        sorted.forEach(function (entry) {
            var code = COUNTRY_CODES[entry[0]] || '';
            var flag = code ? flagImg(code) : '';
            var pct = Math.round((entry[1] / max) * 100);
            var row = document.createElement('div');
            row.className = 'visitors-analytics-row';
            row.innerHTML =
                '<span class="visitors-analytics-label">' + flag + entry[0] + '</span>' +
                '<div class="visitors-analytics-bar-wrap"><div class="visitors-analytics-bar" style="width:' + pct + '%"></div></div>' +
                '<span class="visitors-analytics-count">' + entry[1] + '</span>';
            container.appendChild(row);
        });
    }

    // ── Stats ──
    function loadStats() {
        uniqueEl.textContent = allVisitors.length.toString();
        var seen = {};
        allVisitors.forEach(function (v) {
            if (v.lat != null && v.lng != null) seen[v.lat + '_' + v.lng] = true;
        });
        totalEl.textContent = Object.keys(seen).length.toString();
    }

    // ── Map dots ──
    function loadAllDots() {
        allVisitors.forEach(function (v) {
            if (v.lat && v.lng) addDot(v.lat, v.lng, buildLabel(v), false);
        });
    }

    // ── Current visitor detection ──
    function showCurrentVisitor(lat, lng, label) {
        locationEl.textContent = label || 'Detected';
        addDot(lat, lng, label + ' (you)', true);
        map.setView([lat, lng], 3, { animate: true });
    }

    async function detectCurrentVisitor() {
        try { currentVisitorKey = localStorage.getItem('visitor_ipKey'); } catch(e) {}

        if (currentVisitorKey) {
            var v = allVisitors.find(function(item) { return item.key === currentVisitorKey; });
            if (v && v.lat && v.lng) {
                showCurrentVisitor(v.lat, v.lng, buildLabel(v));
                return;
            }
        }

        var providers = [
            function () {
                return fetch('https://ipwho.is/').then(function (r) { return r.json(); })
                    .then(function (d) { if (!d.success) throw 0; return { lat: d.latitude, lon: d.longitude, city: d.city, country: d.country, region: d.region, ip: d.ip }; });
            },
            function () {
                return fetch('https://ipapi.co/json/').then(function (r) { return r.json(); })
                    .then(function (d) { if (d.error) throw 0; return { lat: d.latitude, lon: d.longitude, city: d.city, country: d.country_name, region: d.region, ip: d.ip }; });
            },
            function () {
                return fetch('https://freeipapi.com/api/json/').then(function (r) { return r.json(); })
                    .then(function (d) { if (!d.latitude) throw 0; return { lat: d.latitude, lon: d.longitude, city: d.cityName, country: d.countryName, region: d.regionName, ip: d.ipAddress }; });
            }
        ];

        for (var i = 0; i < providers.length; i++) {
            try {
                var geo = await providers[i]();
                var lat = Number(geo.lat);
                var lng = Number(geo.lon);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
                if (geo.ip) {
                    currentVisitorKey = hashStr(geo.ip);
                    try { localStorage.setItem('visitor_ipKey', currentVisitorKey); } catch(e) {}
                }
                showCurrentVisitor(lat, lng, buildLabel(geo));
                return;
            } catch (e) { /* try next */ }
        }

        try {
            var cached = JSON.parse(localStorage.getItem('visitor_geo'));
            if (cached && cached.lat && cached.lon) {
                showCurrentVisitor(cached.lat, cached.lon, buildLabel(cached));
                return;
            }
        } catch(e) {}

        locationEl.textContent = 'Unknown';
    }

    // ── Analytics ──
    function loadAnalytics() {
        var countryCounts = {};
        var osCounts = {};
        allVisitors.forEach(function (v) {
            countryCounts[v.country || 'Unknown'] = (countryCounts[v.country || 'Unknown'] || 0) + 1;
            osCounts[v.os || 'Unknown'] = (osCounts[v.os || 'Unknown'] || 0) + 1;
        });
        buildAnalyticsRows(document.getElementById('analytics-countries'), countryCounts);
        buildAnalyticsRows(document.getElementById('analytics-devices'), osCounts);
    }

    // ── Visitors over time chart ──
    function loadVisitorsChart() {
        var dayCounts = {};
        allVisitors.forEach(function (v) {
            if (!v.firstSeen) return;
            var day = v.firstSeen.substring(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(day)) dayCounts[day] = (dayCounts[day] || 0) + 1;
        });

        var dates = Object.keys(dayCounts).sort();
        if (!dates.length) return;

        var cumulative = [];
        var running = 0;
        dates.forEach(function (d) {
            running += dayCounts[d];
            cumulative.push({ date: d, total: running });
        });

        var canvas = document.getElementById('visitors-chart');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        var W = rect.width, H = rect.height;
        var padL = 45, padR = 15, padT = 15, padB = 35;
        var plotW = W - padL - padR, plotH = H - padT - padB;
        var n = cumulative.length, maxVal = cumulative[n - 1].total;

        function xPos(i) { return padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW); }
        function yPos(i) { return padT + plotH - (cumulative[i].total / maxVal) * plotH; }

        // Grid + Y labels
        ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
        for (var g = 0; g <= 4; g++) {
            var gy = padT + plotH - (g / 4) * plotH;
            ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + plotW, gy); ctx.stroke();
            ctx.fillStyle = '#999'; ctx.font = '11px system-ui, sans-serif';
            ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(maxVal * g / 4), padL - 8, gy);
        }

        // Area fill
        ctx.beginPath(); ctx.moveTo(padL, padT + plotH);
        for (var i = 0; i < n; i++) ctx.lineTo(xPos(i), yPos(i));
        ctx.lineTo(xPos(n - 1), padT + plotH); ctx.closePath();
        var grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
        grad.addColorStop(0, 'rgba(128, 0, 32, 0.15)');
        grad.addColorStop(1, 'rgba(128, 0, 32, 0.02)');
        ctx.fillStyle = grad; ctx.fill();

        // Line
        ctx.beginPath();
        for (var i = 0; i < n; i++) {
            if (i === 0) ctx.moveTo(xPos(i), yPos(i)); else ctx.lineTo(xPos(i), yPos(i));
        }
        ctx.strokeStyle = '#800020'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

        // Dots
        ctx.fillStyle = '#800020';
        for (var i = 0; i < n; i++) {
            ctx.beginPath(); ctx.arc(xPos(i), yPos(i), 3, 0, Math.PI * 2); ctx.fill();
        }

        // X labels
        ctx.fillStyle = '#999'; ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        var labelCount = Math.min(n, 5);
        for (var j = 0; j < labelCount; j++) {
            var idx = Math.round(j * (n - 1) / (labelCount - 1 || 1));
            var parts = cumulative[idx].date.split('-');
            ctx.fillText(parts[1] + '/' + parts[2], xPos(idx), padT + plotH + 10);
        }
    }

    // ── Recent visits ──
    function loadRecentVisits() {
        var listEl = document.getElementById('recent-visits-list');
        if (!allVisitors.length) {
            listEl.innerHTML = '<p class="visitors-note">No visits yet.</p>';
            return;
        }

        var sorted = allVisitors.slice().sort(function (a, b) {
            return (b.lastSeen || '').localeCompare(a.lastSeen || '');
        });

        listEl.innerHTML = '';
        sorted.slice(0, 10).forEach(function (v) {
            var isCurrent = v.key && currentVisitorKey === v.key;
            var flag = getFlag(v);
            var loc = buildLabel(v) + (isCurrent ? ' <span style="color:#800020;font-size:0.8em;vertical-align:top;">(you)</span>' : '');
            var when = v.lastSeen ? new Date(v.lastSeen) : null;
            var timeStr = when && !isNaN(when.getTime())
                ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  + ' at ' + when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
                : 'Unknown date';

            var item = document.createElement('div');
            item.className = 'visitors-summary-item' + (isCurrent ? ' highlight-current' : '');
            item.innerHTML =
                '<span class="visitors-summary-key">' + flag + loc + '</span>' +
                '<span class="visitors-summary-value">' + timeStr + (v.os ? ' · ' + v.os : '') + '</span>';
            listEl.appendChild(item);
        });
    }

    // ── Boot ──
    window.addEventListener('load', async function () {
        await loadVisitors();
        loadStats();
        loadAllDots();
        loadAnalytics();
        loadVisitorsChart();
        await detectCurrentVisitor();
        loadRecentVisits();
    });
})();
