// 四国の中心付近
const shikoku = [33.75, 133.5];

// 地図を作成
const map = L.map("map").setView(shikoku, 8);

// OpenStreetMap
L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: '&copy; OpenStreetMap contributors'
    }
).addTo(map);


// --------------------------------
// 寺データを読み込む
// --------------------------------

fetch("data/temples.json")
    .then(response => response.json())
    .then(temples => {

        // 88ヶ所を1件ずつ処理
        temples.forEach(temple => {

            // ピンを作る
              const marker = L.marker(
    [temple.latitude, temple.longitude],
    {
        icon: L.divIcon({
            className: "temple-marker",
            html: `<div>${temple.number}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        })
    }
).addTo(map);

            // ピンをタップしたときの情報
            marker.bindPopup(`
                <strong>第${temple.number}番 ${temple.name}</strong>
                <br>
                ${temple.prefecture}
                <br>
                ${temple.address}
            `);
        });

    })
    .catch(error => {
        console.error("寺データの読み込みに失敗しました:", error);
    });