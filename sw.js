/* ============================================
   Service Worker (sw.js)
   অফলাইনে অ্যাপ চালানোর জন্য ফাইল ক্যাশ করে
   ============================================ */

const CACHE_NAME = 'parvez-image-uploader-v1.0';

// যেসব ফাইল অফলাইনে চালানোর জন্য ক্যাশ হবে
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-database-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js'
];

// ১) Install — ফাইলগুলো ক্যাশে সেভ করা
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // একটা ফাইল fail হলেও বাকিগুলো ক্যাশ হবে
            for (const url of ASSETS_TO_CACHE) {
                try {
                    await cache.add(url);
                } catch (err) {
                    console.log('⚠️ ক্যাশ করা যায়নি:', url);
                }
            }
        })
    );
});

// ২) Activate — পুরনো ক্যাশ মুছে ফেলা
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ৩) Fetch — অনলাইনে নতুন ফাইল, অফলাইনে ক্যাশ থেকে লোড
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // শুধু GET রিকোয়েস্ট হ্যান্ডেল হবে
    if (req.method !== 'GET') return;

    let url;
    try {
        url = new URL(req.url);
    } catch (e) {
        return;
    }

    // http/https ছাড়া রিকোয়েস্ট বাদ
    if (!url.protocol.startsWith('http')) return;

    // Firebase ডেটাবেস ও ImgBB API ক্যাশ হবে না (লাইভ ডেটা)
    if (url.hostname.includes('firebaseio.com')) return;
    if (url.hostname.includes('imgbb.com')) return;

    // পেজ নেভিগেশন — নেটওয়ার্ক আগে, না পেলে ক্যাশ
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).then((res) => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
                return res;
            }).catch(() => caches.match('./index.html'))
        );
        return;
    }

    // বাকি সব ফাইল — ক্যাশ আগে, পরে ব্যাকগ্রাউন্ডে আপডেট
    event.respondWith(
        caches.match(req).then((cached) => {
            const fetchPromise = fetch(req).then((res) => {
                if (res && (res.status === 200 || res.type === 'opaque')) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                }
                return res;
            }).catch(() => cached);
            return cached || fetchPromise;
        })
    );
});
