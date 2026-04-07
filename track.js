// Visitor tracking — records approximate location to Firebase on every page load
(function() {
    var firebaseConfig = {
        apiKey: "AIzaSyBKN89D7xDeOrbZcaHskF5eX8CJM4Q5tPU",
        authDomain: "baharoon-visitors.firebaseapp.com",
        databaseURL: "https://baharoon-visitors-default-rtdb.firebaseio.com",
        projectId: "baharoon-visitors",
        storageBucket: "baharoon-visitors.firebasestorage.app",
        messagingSenderId: "16202229023",
        appId: "1:16202229023:web:5e967877c4dc566fe73c2a"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    var db = firebase.database();

    // Simple string hash (djb2) to avoid storing raw IPs
    function hashStr(s) {
        for (var h = 5381, i = 0; i < s.length; i++)
            h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
        return h.toString(36);
    }

    function getOS() {
        var ua = navigator.userAgent;
        if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
        if (/Mac OS X/.test(ua)) return 'macOS';
        if (/Windows/.test(ua)) return 'Windows';
        if (/CrOS/.test(ua)) return 'ChromeOS';
        if (/Android/.test(ua)) return 'Android';
        if (/Linux/.test(ua)) return 'Linux';
        return 'Unknown';
    }

    function getBrowser() {
        var ua = navigator.userAgent;
        if (/Edg\//.test(ua)) return 'Edge';
        if (/OPR\/|Opera/.test(ua)) return 'Opera';
        if (/Chrome\//.test(ua)) return 'Chrome';
        if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
        if (/Firefox\//.test(ua)) return 'Firefox';
        return 'Other';
    }

    function saveVisitor(geo, ip) {
        var now = new Date();
        var isoNow = now.toISOString();
        var dateKey = isoNow.split('T')[0];
        var ipKey = hashStr(ip);
        var page = location.pathname || '/';
        var ref = db.ref('visitors/' + ipKey);

        // Read once to preserve firstSeen/dates/pages, then write complete object
        ref.once('value').then(function (snap) {
            var existing = snap.val() || {};
            var dates = existing.dates || {};
            dates[dateKey] = true;
            var pages = existing.pages || {};
            pages[page.replace(/\//g, '_')] = true;

            var record = {
                lat: Math.round(geo.lat * 100) / 100,
                lng: Math.round(geo.lon * 100) / 100,
                city: geo.city || '',
                region: geo.region || '',
                country: geo.country || '',
                countryCode: geo.countryCode || '',
                os: getOS(),
                browser: getBrowser(),
                language: navigator.language || '',
                referrer: document.referrer || '',
                screenWidth: screen.width || 0,
                screenHeight: screen.height || 0,
                firstSeen: existing.firstSeen || isoNow,
                lastSeen: isoNow,
                visits: (existing.visits || 0) + 1,
                dates: dates,
                pages: pages
            };
            ref.set(record);
        });
    }

    async function tryIpwho() {
        var r = await fetch('https://ipwho.is/');
        var d = await r.json();
        if (!d.success) throw new Error('fail');
        return { lat: d.latitude, lon: d.longitude, city: d.city, country: d.country, countryCode: d.country_code, region: d.region, ip: d.ip };
    }
    async function tryIpapi() {
        var r = await fetch('https://ipapi.co/json/');
        var d = await r.json();
        if (d.error) throw new Error('fail');
        return { lat: d.latitude, lon: d.longitude, city: d.city, country: d.country_name, countryCode: d.country_code, region: d.region, ip: d.ip };
    }
    async function tryFreeIpapi() {
        var r = await fetch('https://freeipapi.com/api/json/');
        var d = await r.json();
        if (!d.latitude) throw new Error('fail');
        return { lat: d.latitude, lon: d.longitude, city: d.cityName, country: d.countryName, countryCode: d.countryCode, region: d.regionName, ip: d.ipAddress };
    }

    async function trackVisitor() {
        var providers = [tryIpwho, tryIpapi, tryFreeIpapi];
        for (var i = 0; i < providers.length; i++) {
            try {
                var geo = await providers[i]();
                var lat = Number(geo.lat);
                var lng = Number(geo.lon);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
                saveVisitor(geo, geo.ip);
                return;
            } catch (e) { /* try next */ }
        }
    }

    trackVisitor();
})();
