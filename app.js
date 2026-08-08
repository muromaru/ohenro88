// 四国の中心付近
const shikoku = [33.75, 133.5];
// 地図を作成
const map = L.map("map").setView(shikoku, 8);
// OpenStreetMapの地図を使用
L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: '&copy; OpenStreetMap contributors'
    }
).addTo(map);