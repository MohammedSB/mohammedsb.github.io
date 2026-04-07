// ── visitors-map.js — Map, stats, and recent visits for visitors.html ──
// Requires: Leaflet, Firebase (initialised by track.js)
// Schema: visitors/{ipHash} = { lat, lng, city, region, country, countryCode,
//   os, browser, language, referrer, screenWidth, screenHeight,
//   firstSeen, lastSeen, visits, dates/{YYYY-MM-DD}: true, pages/{path}: true }

(function () {
    var db = firebase.database();

    // ── DOM elements ──
    var uniqueEl  = document.getElementById('visitor-unique');
    var totalEl   = document.getElementById('visitor-total');
    var locationEl = document.getElementById('visitor-location');

    // ── Shared data cache (loaded once, used by all sections) ──
    var allVisitors = null; // array of visitor objects

    function loadVisitors() {
        return db.ref('visitors').once('value').then(function (snap) {
            var data = snap.val();
            allVisitors = data ? Object.values(data) : [];
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

    // ── Stat counters ──
    function loadStats() {
        // Unique visitors = total entries (one per IP hash)
        uniqueEl.textContent = allVisitors.length.toString();

        // Total locations = unique lat/lng pairs
        var seen = {};
        allVisitors.forEach(function (v) {
            if (v.lat != null && v.lng != null) {
                seen[v.lat + '_' + v.lng] = true;
            }
        });
        totalEl.textContent = Object.keys(seen).length.toString();
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

    function buildLabel(v) {
        var parts = [v.city];
        if (v.country === 'United States' && v.region) parts.push(v.region);
        parts.push(v.country);
        return parts.filter(Boolean).join(', ') || 'Unknown';
    }

    function loadAllDots() {
        allVisitors.forEach(function (v) {
            if (v.lat && v.lng) {
                addDot(v.lat, v.lng, buildLabel(v), false);
            }
        });
    }

    // ── Current visitor location ──
    async function detectCurrentVisitor() {
        var providers = [
            function () {
                return fetch('https://ipwho.is/').then(function (r) { return r.json(); })
                    .then(function (d) { if (!d.success) throw 0; return { lat: d.latitude, lon: d.longitude, city: d.city, country: d.country, region: d.region }; });
            },
            function () {
                return fetch('https://ipapi.co/json/').then(function (r) { return r.json(); })
                    .then(function (d) { if (d.error) throw 0; return { lat: d.latitude, lon: d.longitude, city: d.city, country: d.country_name, region: d.region }; });
            },
            function () {
                return fetch('https://freeipapi.com/api/json/').then(function (r) { return r.json(); })
                    .then(function (d) { if (!d.latitude) throw 0; return { lat: d.latitude, lon: d.longitude, city: d.cityName, country: d.countryName, region: d.regionName }; });
            }
        ];

        for (var i = 0; i < providers.length; i++) {
            try {
                var geo = await providers[i]();
                var lat = Number(geo.lat);
                var lng = Number(geo.lon);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

                var parts = [geo.city];
                if (geo.country === 'United States' && geo.region) parts.push(geo.region);
                parts.push(geo.country);
                var label = parts.filter(Boolean).join(', ');
                locationEl.textContent = label || 'Detected';
                addDot(lat, lng, label + ' (you)', true);
                map.setView([lat, lng], 3, { animate: true });
                return;
            } catch (e) { /* try next */ }
        }

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

    // ── Analytics ──
    function loadAnalytics() {
        // Country distribution
        var countryCounts = {};
        allVisitors.forEach(function (v) {
            var c = v.country || 'Unknown';
            countryCounts[c] = (countryCounts[c] || 0) + 1;
        });
        var topCountries = Object.entries(countryCounts)
            .sort(function (a, b) { return b[1] - a[1]; })
            .slice(0, 6);
        var maxC = topCountries[0] ? topCountries[0][1] : 1;
        var countriesEl = document.getElementById('analytics-countries');
        countriesEl.innerHTML = '';
        topCountries.forEach(function (entry) {
            var code = COUNTRY_CODES[entry[0]] || '';
            var flag = code ? flagImg(code) : '';
            var pct = Math.round((entry[1] / maxC) * 100);
            var row = document.createElement('div');
            row.className = 'visitors-analytics-row';
            row.innerHTML =
                '<span class="visitors-analytics-label">' + flag + entry[0] + '</span>' +
                '<div class="visitors-analytics-bar-wrap"><div class="visitors-analytics-bar" style="width:' + pct + '%"></div></div>' +
                '<span class="visitors-analytics-count">' + entry[1] + '</span>';
            countriesEl.appendChild(row);
        });

        // Device / OS distribution
        var osCounts = {};
        allVisitors.forEach(function (v) {
            var os = v.os || 'Unknown';
            osCounts[os] = (osCounts[os] || 0) + 1;
        });
        var topOS = Object.entries(osCounts)
            .sort(function (a, b) { return b[1] - a[1]; });
        var maxO = topOS[0] ? topOS[0][1] : 1;
        var devicesEl = document.getElementById('analytics-devices');
        devicesEl.innerHTML = '';
        topOS.forEach(function (entry) {
            var pct = Math.round((entry[1] / maxO) * 100);
            var row = document.createElement('div');
            row.className = 'visitors-analytics-row';
            row.innerHTML =
                '<span class="visitors-analytics-label">' + entry[0] + '</span>' +
                '<div class="visitors-analytics-bar-wrap"><div class="visitors-analytics-bar" style="width:' + pct + '%"></div></div>' +
                '<span class="visitors-analytics-count">' + entry[1] + '</span>';
            devicesEl.appendChild(row);
        });
    }

    // ── Visitors over time chart ──
    function loadVisitorsChart() {
        // Count first appearance of each unique visitor by date
        var dayCounts = {};
        allVisitors.forEach(function (v) {
            if (!v.firstSeen) return;
            var day = v.firstSeen.substring(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
                dayCounts[day] = (dayCounts[day] || 0) + 1;
            }
        });

            // Sort dates and build cumulative totals
            var dates = Object.keys(dayCounts).sort();
            if (dates.length === 0) return;

            var cumulative = [];
            var running = 0;
            dates.forEach(function (d) {
                running += dayCounts[d];
                cumulative.push({ date: d, total: running });
            });

            // Draw on canvas
            var canvas = document.getElementById('visitors-chart');
            if (!canvas) return;
            var ctx = canvas.getContext('2d');
            var dpr = window.devicePixelRatio || 1;
            var rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);

            var W = rect.width;
            var H = rect.height;
            var padL = 45, padR = 15, padT = 15, padB = 35;
            var plotW = W - padL - padR;
            var plotH = H - padT - padB;
            var n = cumulative.length;
            var maxVal = cumulative[n - 1].total;

            // Grid lines
            ctx.strokeStyle = '#eee';
            ctx.lineWidth = 1;
            var gridLines = 4;
            for (var g = 0; g <= gridLines; g++) {
                var gy = padT + plotH - (g / gridLines) * plotH;
                ctx.beginPath();
                ctx.moveTo(padL, gy);
                ctx.lineTo(padL + plotW, gy);
                ctx.stroke();

                // Y-axis labels
                ctx.fillStyle = '#999';
                ctx.font = '11px system-ui, sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(Math.round(maxVal * g / gridLines), padL - 8, gy);
            }

            // Draw area fill
            ctx.beginPath();
            ctx.moveTo(padL, padT + plotH);
            for (var i = 0; i < n; i++) {
                var x = padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
                var y = padT + plotH - (cumulative[i].total / maxVal) * plotH;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(padL + (n === 1 ? plotW / 2 : plotW), padT + plotH);
            ctx.closePath();
            var grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
            grad.addColorStop(0, 'rgba(128, 0, 32, 0.15)');
            grad.addColorStop(1, 'rgba(128, 0, 32, 0.02)');
            ctx.fillStyle = grad;
            ctx.fill();

            // Draw line
            ctx.beginPath();
            for (var i = 0; i < n; i++) {
                var x = padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
                var y = padT + plotH - (cumulative[i].total / maxVal) * plotH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = '#800020';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.stroke();

            // Draw dots on line
            for (var i = 0; i < n; i++) {
                var x = padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
                var y = padT + plotH - (cumulative[i].total / maxVal) * plotH;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#800020';
                ctx.fill();
            }

            // X-axis date labels (show ~5 evenly spaced)
            ctx.fillStyle = '#999';
            ctx.font = '11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            var labelCount = Math.min(n, 5);
            for (var j = 0; j < labelCount; j++) {
                var idx = Math.round(j * (n - 1) / (labelCount - 1 || 1));
                var x = padL + (n === 1 ? plotW / 2 : (idx / (n - 1)) * plotW);
                var d = cumulative[idx].date;
                var parts = d.split('-');
                var label = parts[1] + '/' + parts[2];
                ctx.fillText(label, x, padT + plotH + 10);
            }
        });
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
            var flag = getFlag(v);
            var loc = buildLabel(v);
            var os = v.os || '';
            var when = v.lastSeen ? new Date(v.lastSeen) : null;
            var timeStr = when && !isNaN(when.getTime())
                ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  + ' at ' + when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
                : 'Unknown date';

            var item = document.createElement('div');
            item.className = 'visitors-summary-item';
            item.innerHTML =
                '<span class="visitors-summary-key">' + flag + loc + '</span>' +
                '<span class="visitors-summary-value">' + timeStr + (os ? ' · ' + os : '') + '</span>';
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
        loadRecentVisits();
        detectCurrentVisitor();
    });
})();
