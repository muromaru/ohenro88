// ========================================
// 四国八十八ヶ所マップ
// ========================================
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
// ========================================
// 訪問データ
// ========================================
// localStorageに保存する名前
const STORAGE_KEY = "henro88_visits";
// 保存されている訪問データを取得
function getVisitData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        return JSON.parse(data);
    }
    return {};
}
// 訪問データを保存
function saveVisitData(data) {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );
}
// ========================================
// 訪問状態を変更
// ========================================
function toggleVisited(templeNumber) {
    const visitData = getVisitData();
    if (visitData[templeNumber]) {
        // すでに訪問済みなら削除
        delete visitData[templeNumber];
    } else {
        // 今日の日付を取得
        const today = new Date();
        const date =
            today.getFullYear() +
            "-" +
            String(today.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(today.getDate()).padStart(2, "0");
        visitData[templeNumber] = {
            visited: true,
            date: date
        };
    }
    saveVisitData(visitData);
    // 地図を再描画
    loadTemples();
}
// ========================================
// 日付を表示用に変換
// ========================================
function formatDate(dateString) {
    const [year, month, day] = dateString.split("-");
    return `${year}年${Number(month)}月${Number(day)}日`;
}
// ========================================
// 寺データを読み込む
// ========================================
function loadTemples() {
    fetch("data/temples.json")
        .then(response => response.json())
        .then(temples => {
            // 現在のマーカーを削除
            map.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    map.removeLayer(layer);
                }
            });
            const visitData = getVisitData();
            const markers = [];
            temples.forEach(temple => {
                const visit = visitData[temple.number];
                const visited = !!visit;
                // ------------------------------
                // ピンの色
                // ------------------------------
                const markerClass =
                    visited
                        ? "temple-marker visited"
                        : "temple-marker";
                // ------------------------------
                // 番号付きピン
                // ------------------------------
                const marker = L.marker(
                    [
                        temple.latitude,
                        temple.longitude
                    ],
                    {
                        icon: L.divIcon({
                            className: markerClass,
                            html: `
                                <div>
                                    ${temple.number}
                                </div>
                            `,
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        })
                    }
                ).addTo(map);
                // ------------------------------
                // 詳細情報
                // ------------------------------
                let visitHtml = "";
                if (visited) {
                    visitHtml = `
                        <div class="visited-info">
                            🟢 訪問済み<br>
                            訪問日：${formatDate(visit.date)}
                        </div>
                        <button
                            onclick="toggleVisited(${temple.number})"
                        >
                            未訪問に戻す
                        </button>
                    `;
                } else {
                    visitHtml = `
                        <div class="not-visited">
                            🔴 未訪問
                        </div>
                        <button
                            onclick="toggleVisited(${temple.number})"
                        >
                            訪問済みにする
                        </button>
                    `;
                }
                // ------------------------------
                // ポップアップ
                // ------------------------------
                marker.bindPopup(`
                    <div class="temple-popup">
                        <h3>
                            第${temple.number}番
                            ${temple.name}
                        </h3>
                        <p>
                            ${temple.prefecture}
                            <br>
                            ${temple.address}
                        </p>
                        ${visitHtml}
                    </div>
                `);
                markers.push(marker);
            });
            // ------------------------------
            // 88ヶ所が全部見えるようにする
            // ------------------------------
            if (markers.length > 0) {
                const group =
                    L.featureGroup(markers);
                map.fitBounds(
                    group.getBounds(),
                    {
                        padding: [30, 30]
                    }
                );
            }
        })
        .catch(error => {
            console.error(
                "寺データの読み込みに失敗しました:",
                error
            );
        });
}
// ========================================
// 開始
// ========================================
loadTemples();