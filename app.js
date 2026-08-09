import { initializeApp } 
    from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";


// ========================================
// Firebase
// ========================================

const firebaseConfig = {
    apiKey: "AIzaSyAuwXe21V2eMiUW2TudECgHkVoHY3-XlCU",
    authDomain: "ohenro88-e3cb1.firebaseapp.com",
    projectId: "ohenro88-e3cb1",
    storageBucket: "ohenro88-e3cb1.firebasestorage.app",
    messagingSenderId: "643685913931",
    appId: "1:643685913931:web:51354d87882b02609404ce"
};

const firebaseApp = initializeApp(firebaseConfig);

const storage = getStorage(firebaseApp);

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
// 札所詳細画面
// ========================================

let currentTempleNumber = null;

function openTempleDetail(temple) {

    currentTempleNumber = temple.number;

    const visitData = getVisitData();
    const visit = visitData[temple.number];

    document.getElementById("detail-title").textContent =
        `第${temple.number}番 ${temple.name}`;

    document.getElementById("detail-address").innerHTML =
        `${temple.prefecture}<br>${temple.address}`;

    // 写真を読み込む
    loadTemplePhotos(temple.number);

    // 訪問日
    const dateInput =
        document.getElementById("visit-date");

    if (visit) {

        dateInput.value = visit.date;

    } else {

        const today = new Date();

        const date =
            today.getFullYear() +
            "-" +
            String(today.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(today.getDate()).padStart(2, "0");

        dateInput.value = date;
    }

    updateDetailStatus(visit);

    document.getElementById("temple-detail")
        .classList.remove("hidden");
}

function updateDetailStatus(visit) {

    const status =
        document.getElementById("detail-status");

    const button =
        document.getElementById("detail-visit-button");

    if (visit) {

        status.innerHTML = `
            <div class="visited-info">
                🟢 訪問済み<br>
                訪問日：${formatDate(visit.date)}
            </div>
        `;

        button.textContent = "未訪問に戻す";

    } else {

        status.innerHTML = `
            <div class="not-visited">
                🔴 未訪問
            </div>
        `;

        button.textContent = "訪問済みにする";
    }
}

// ========================================
// 訪問状態を変更
// ========================================
function toggleVisited(templeNumber) {

    const visitData = getVisitData();

    if (visitData[templeNumber]) {

        // 訪問済みなら未訪問に戻す
        delete visitData[templeNumber];

    } else {

        // 画面で選択された訪問日
        const dateInput =
            document.getElementById("visit-date");

        const date = dateInput.value;

        if (!date) {
            alert("訪問日を選択してください");
            return;
        }

        visitData[templeNumber] = {
            visited: true,
            date: date
        };
    }

    saveVisitData(visitData);

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
                // ポップアップ
                // ------------------------------
                marker.on("click", () => {
                    openTempleDetail(temple);
                });
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
// 詳細画面のボタン処理
// ========================================

// 訪問済み・未訪問を切り替える
document.getElementById("detail-visit-button")
    .addEventListener("click", () => {

        if (currentTempleNumber === null) {
            return;
        }

        toggleVisited(currentTempleNumber);

        const visitData = getVisitData();

        updateDetailStatus(
            visitData[currentTempleNumber]
        );
    });

// 詳細画面を閉じる
document.getElementById("detail-close")
    .addEventListener("click", () => {

        document.getElementById("temple-detail")
            .classList.add("hidden");

        currentTempleNumber = null;
    });

// ========================================
// 写真アップロード
// ========================================

document.getElementById("photo-add-button")
    .addEventListener("click", () => {

        document.getElementById("photo-input").click();

    });


// 写真が選択された
document.getElementById("photo-input")
    .addEventListener("change", async (event) => {

        const file = event.target.files[0];

        if (!file) {
            return;
        }

        if (currentTempleNumber === null) {
            return;
        }

        const status =
            document.getElementById("photo-status");

        status.textContent = "写真をアップロード中...";

        try {

            // ファイル名を作成
            const fileName =
                `${Date.now()}_${file.name}`;

            // 保存先
            const photoRef = ref(
                storage,
                `photos/${String(currentTempleNumber).padStart(3, "0")}/${fileName}`
            );

            // Firebase Storageへアップロード
            await uploadBytes(
                photoRef,
                file
            );

            // ダウンロードURLを取得
            const downloadURL =
                await getDownloadURL(photoRef);

            console.log(
                "アップロード成功:",
                downloadURL
            );

            // 画面に写真を表示
            const photoContainer =
                document.getElementById("temple-photos");

            const img =
                document.createElement("img");

            img.src = downloadURL;

            img.className = "temple-photo";

            photoContainer.appendChild(img);

            status.textContent =
                "写真をアップロードしました";

        } catch (error) {

            console.error(
                "写真のアップロードに失敗しました:",
                error
            );

            status.textContent =
                "写真のアップロードに失敗しました";
        }

        // 同じ写真をもう一度選択できるようにする
        event.target.value = "";
    });
// ========================================
// 開始
// ========================================
loadTemples();