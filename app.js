import { initializeApp } 
    from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    listAll,
    deleteObject
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

import {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    setDoc,
    collection,
    onSnapshot,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

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

const db = getFirestore(firebaseApp);

// ========================================
// 四国八十八ヶ所マップ
// ========================================
// ========================================
// 四国エリアに地図を固定
// ========================================
const shikoku = [33.75, 133.5];
// 四国の表示範囲
const shikokuBounds = L.latLngBounds(
    [32.7, 132.0],  // 南西
    [34.5, 134.8]   // 北東
);
const map = L.map("map", {
    minZoom: 8,
    maxZoom: 18,
    maxBounds: shikokuBounds,
    maxBoundsViscosity: 1.0
}).fitBounds(shikokuBounds);
// OpenStreetMap
L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: '&copy; OpenStreetMap contributors'
    }
).addTo(map);

// ========================================
// 札所詳細画面
// ========================================

let currentTempleNumber = null;
let templeSearchText = "";
let templeFilter = "all";
let currentVisitData = {};

async function openTempleDetail(temple) {

    currentTempleNumber =
        temple.number;

    // Firestoreから取得
    const visit =
        await getVisitFromFirestore(
            temple.number
        );

    document.getElementById(
        "detail-title"
    ).textContent =
        `第${temple.number}番 ${temple.name}`;

    document.getElementById(
        "detail-address"
    ).innerHTML =
        `${temple.prefecture}<br>${temple.address}`;

    // 写真
    loadTemplePhotos(
        temple.number
    );

    // ------------------------------
    // 訪問日
    // ------------------------------

    const dateInput =
        document.getElementById(
            "visit-date"
        );

    if (visit && visit.date) {

        dateInput.value =
            visit.date;

    } else {

        const today =
            new Date();

        const date =
            today.getFullYear() +
            "-" +
            String(
                today.getMonth() + 1
            ).padStart(2, "0") +
            "-" +
            String(
                today.getDate()
            ).padStart(2, "0");

        dateInput.value =
            date;
    }

    // ------------------------------
    // メモ
    // ------------------------------

    const memoInput =
        document.getElementById(
            "visit-memo"
        );

    if (visit && visit.memo) {

        memoInput.value =
            visit.memo;

    } else {

        memoInput.value =
            "";

    }

    updateDetailStatus(
        visit
    );

    const detailSheet =
        document.getElementById("temple-detail");
    
    detailSheet.classList.remove(
        "hidden",
        "sheet-small",
        "sheet-large"
    );
    
    detailSheet.classList.add(
        "sheet-medium"
    );
}

function updateDetailStatus(visit) {

    const status =
        document.getElementById("detail-status");

    const button =
        document.getElementById("detail-visit-button");

    const isVisited =
        !!visit && visit.visited === true;

    if (isVisited) {

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
async function toggleVisited(templeNumber) {

    try {

        const visitRef =
            doc(
                db,
                "visits",
                String(templeNumber).padStart(3, "0")
            );

        const snapshot =
            await getDoc(visitRef);

        const current =
            snapshot.exists()
                ? snapshot.data()
                : null;

        const isVisited =
            !!current && current.visited === true;

        if (isVisited) {

            // 訪問済み → 未訪問に戻す（メモは残す）
            await setDoc(
                visitRef,
                {
                    visited: false,
                    memo: current.memo || ""
                }
            );

        } else {

            // 未訪問 → 訪問済みにする（メモがあれば残す）
            const date =
                document.getElementById("visit-date").value;

            if (!date) {
                alert("訪問日を選択してください");
                return;
            }

            await setDoc(
                visitRef,
                {
                    visited: true,
                    date: date,
                    memo: (current && current.memo) || ""
                }
            );
        }

    } catch (error) {

        console.error("訪問状態の変更に失敗しました:", error);
        alert("訪問状態の変更に失敗しました\n" + error.message);
    }
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
async function loadTemples() {

    try {

        const response =
            await fetch("data/temples.json");

        const temples =
            await response.json();

        // Firestoreから訪問データを取得
        const visitData = currentVisitData;

        updateProgress(visitData);
        
        updateTempleList(
            temples,
            visitData
        );

        // 現在のマーカーを削除
        map.eachLayer(layer => {

            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }

        });

        const markers = [];

        temples.forEach(temple => {

            const visit =
                visitData[temple.number];

            const visited =
                !!visit && visit.visited === true;

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
            // 札所をクリック
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
                    padding: [30, 30],
                    maxZoom: 9
                }
            );
        }

    } catch (error) {

        console.error(
            "寺データの読み込みに失敗しました:",
            error
        );

        alert(
            "寺データの読み込みに失敗しました\n" +
            error.message
        );
    }
}

// ========================================
// 詳細画面のボタン処理
// ========================================

// 訪問済み・未訪問を切り替える
document.getElementById("detail-visit-button")
    .addEventListener(
        "click",
        async () => {

            if (
                currentTempleNumber === null
            ) {
                return;
            }

            await toggleVisited(
                currentTempleNumber
            );

            // Firestoreから最新状態を取得
            const visit =
                await getVisitFromFirestore(
                    currentTempleNumber
                );

            updateDetailStatus(
                visit
            );

        }
    );

// 詳細画面を閉じる
function closeTempleDetail() {

    document.getElementById("temple-detail")
        .classList.add("hidden");

    currentTempleNumber = null;
}

document.getElementById("detail-close")
    .addEventListener(
        "click",
        closeTempleDetail
    );

// ========================================
// 詳細画面の外側をタップしたら閉じる
// ========================================
document.getElementById("temple-detail")
    .addEventListener("click", (event) => {

        // タップされた場所が詳細画面そのものなら閉じる
        if (event.target === event.currentTarget) {

            document.getElementById("temple-detail")
                .classList.add("hidden");

            currentTempleNumber = null;
        }

    });

// ========================================
// 地図をタップしたら詳細画面を閉じる
// ========================================
map.on("click", () => {

    const detail =
        document.getElementById("temple-detail");

    if (!detail.classList.contains("hidden")) {

        detail.classList.add("hidden");

        currentTempleNumber = null;
    }

});



// ========================================
// 保存済み写真を読み込む
// ========================================

async function loadTemplePhotos(templeNumber) {
    const photoContainer =
        document.getElementById("temple-photos");
    const status =
        document.getElementById("photo-status");
    // 一旦、現在表示されている写真を消す
    photoContainer.innerHTML = "";
    status.textContent =
        `写真を読み込み中...`;
    try {
        // 寺ごとのフォルダ
        const folderRef = ref(
            storage,
            `photos/${String(templeNumber).padStart(3, "0")}`
        );
        // フォルダ内のファイル一覧を取得
        const result = await listAll(folderRef);
        // 写真がない場合
        if (result.items.length === 0) {
            status.textContent =
                "まだ写真はありません";
            return;
        }
        // 写真を1枚ずつ取得
        for (const itemRef of result.items) {
            // ダウンロードURL
            const downloadURL =
                await getDownloadURL(itemRef);
            // ------------------------------
            // 写真を囲むdiv
            // ------------------------------
            const photoWrapper =
                document.createElement("div");
            photoWrapper.className =
                "photo-wrapper";
            // ------------------------------
            // 写真
            // ------------------------------
            const img =
                document.createElement("img");
            img.src = downloadURL;
            img.className =
                "temple-photo";
            img.addEventListener("click", () => {
                const viewer =
                    document.getElementById("photo-viewer");
                const viewerImage =
                    document.getElementById("photo-viewer-image");
                viewerImage.src = downloadURL;
                viewer.classList.remove("hidden");
            });
            // ------------------------------
            // 削除ボタン
            // ------------------------------
            const deleteButton =
                document.createElement("button");
            deleteButton.textContent =
                "🗑 写真を削除";
            deleteButton.className =
                "photo-delete-button";
            // ------------------------------
            // 削除処理
            // ------------------------------
            deleteButton.addEventListener(
                "click",
                async () => {
                    const answer =
                        confirm(
                            "この写真を削除しますか？"
                        );
                    if (!answer) {
                        return;
                    }
                    try {
                        deleteButton.disabled =
                            true;
                        deleteButton.textContent =
                            "削除中...";
                        // Firebase Storageから削除
                        await deleteObject(itemRef);
                        // 画面から削除
                        photoWrapper.remove();
                        status.textContent =
                            "写真を削除しました";
                    } catch (error) {
                        console.error(
                            "写真の削除に失敗しました:",
                            error
                        );
                        alert(
                            "写真の削除に失敗しました"
                        );
                        deleteButton.disabled =
                            false;
                        deleteButton.textContent =
                            "🗑 写真を削除";
                    }
                }
            );
            // ------------------------------
            // 画面に追加
            // ------------------------------
            photoWrapper.appendChild(img);
            photoWrapper.appendChild(
                deleteButton
            );
            photoContainer.appendChild(
                photoWrapper
            );
        }
        status.textContent =
            `${result.items.length}枚の写真`;
    } catch (error) {
        console.error(
            "写真の読み込みに失敗しました:",
            error
        );
        status.textContent =
            "写真の読み込みに失敗しました";
    }
}

async function getVisitFromFirestore(templeNumber) {

    try {

        const visitRef = doc(
            db,
            "visits",
            String(templeNumber).padStart(3, "0")
        );

        const snapshot =
            await getDoc(visitRef);

        if (snapshot.exists()) {

            return snapshot.data();

        }

        return null;

    } catch (error) {

        console.error(
            "Firestore読み込み失敗:",
            error
        );

        alert(
            "Firestoreからの読み込みに失敗しました\n" +
            error.message
        );

        return null;
    }
}

async function getAllVisitsFromFirestore() {

    try {

        const visitsRef =
            collection(db, "visits");

        const snapshot =
            await getDocs(visitsRef);

        const visitData = {};

        snapshot.forEach((docSnapshot) => {

            const templeNumber =
                Number(docSnapshot.id);

            visitData[templeNumber] =
                docSnapshot.data();

        });

        return visitData;

    } catch (error) {

        console.error(
            "訪問データの取得に失敗しました:",
            error
        );

        alert(
            "訪問データの取得に失敗しました\n" +
            error.message
        );

        return {};
    }
}

function startVisitListener() {

    const visitsRef =
        collection(db, "visits");

    onSnapshot(
        visitsRef,
        (snapshot) => {

            const visitData = {};

            snapshot.forEach((docSnapshot) => {

                const templeNumber =
                    Number(docSnapshot.id);

                visitData[templeNumber] =
                    docSnapshot.data();

            });
            // 現在の訪問データを更新
            currentVisitData = visitData;
    
            // 進捗更新
            updateProgress(visitData);
　
            // 地図を更新
            loadTemples();

            // 現在開いている札所も更新
            if (currentTempleNumber !== null) {

                const visit =
                    visitData[currentTempleNumber];

                updateDetailStatus(visit);

                const dateInput =
                    document.getElementById(
                        "visit-date"
                    );

                const memoInput =
                    document.getElementById(
                        "visit-memo"
                    );

                if (visit) {

                    dateInput.value =
                        visit.date || "";

                    memoInput.value =
                        visit.memo || "";

                } else {

                    memoInput.value = "";

                }
            }

        },
        (error) => {

            console.error(
                "リアルタイム監視エラー:",
                error
            );

        }
    );
}

function updateProgress(visitData) {

    let visitedCount = 0;

    for (let i = 1; i <= 88; i++) {

        const visit = visitData[i];

        if (visit && visit.visited === true) {
            visitedCount++;
        }
    }

    const percent =
        (visitedCount / 88) * 100;

    document.getElementById(
        "progress-count"
    ).textContent =
        `${visitedCount} / 88`;

    document.getElementById(
        "progress-percent"
    ).textContent =
        `${percent.toFixed(1)}%`;
}

// ========================================
// 写真アップロード
// ========================================
function updateTempleList(
    temples,
    visitData
) {

    const container =
        document.getElementById(
            "temple-list-container"
        );

    container.innerHTML = "";

    // ------------------------------
    // 検索・フィルター
    // ------------------------------

    const filteredTemples =
        temples.filter(temple => {

            const visit =
                visitData[temple.number];

            const visited =
                visit &&
                visit.visited === true;

            // --------------------------
            // 訪問状態
            // --------------------------

            if (
                templeFilter === "visited" &&
                !visited
            ) {
                return false;
            }

            if (
                templeFilter === "unvisited" &&
                visited
            ) {
                return false;
            }

            // --------------------------
            // 検索
            // --------------------------

            if (templeSearchText) {

                const search =
                    templeSearchText
                        .toLowerCase();

                const number =
                    String(temple.number);

                const name =
                    temple.name.toLowerCase();

                if (
                    !number.includes(search) &&
                    !name.includes(search)
                ) {
                    return false;
                }
            }

            return true;

        });

    // ------------------------------
    // 該当なし
    // ------------------------------

    if (filteredTemples.length === 0) {

        container.innerHTML =
            `<div class="no-results">
                該当する札所がありません
            </div>`;

        return;
    }

    // ------------------------------
    // 一覧作成
    // ------------------------------

    filteredTemples.forEach(
        temple => {

            const visit =
                visitData[temple.number];

            const visited =
                visit &&
                visit.visited === true;

            const status =
                visited ? "🟢" : "🔴";

            const dateText =
                visited && visit.date
                    ? formatDate(visit.date)
                    : "未訪問";

            const item =
                document.createElement("div");

            item.className =
                "temple-list-item";

            item.innerHTML = `

                <div class="temple-list-number">
                    ${status} 第${temple.number}番
                </div>

                <div class="temple-list-name">
                    ${temple.name}
                </div>

                <div class="temple-list-date">
                    ${dateText}
                </div>

            `;

            item.addEventListener(
                "click",
                () => {

                    openTempleDetail(temple);

                }
            );

            container.appendChild(item);

        }
    );
}

function setTempleFilter(filter) {

    templeFilter = filter;

    document
        .querySelectorAll(".filter-button")
        .forEach(button => {

            button.classList.remove("active");

        });

    if (filter === "all") {

        document
            .getElementById("filter-all")
            .classList.add("active");

    } else if (filter === "visited") {

        document
            .getElementById("filter-visited")
            .classList.add("active");

    } else if (filter === "unvisited") {

        document
            .getElementById("filter-unvisited")
            .classList.add("active");

    }

    loadTemples();
}

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

document.getElementById("photo-viewer")
    .addEventListener("click", () => {

        document.getElementById("photo-viewer")
            .classList.add("hidden");

    });

document.getElementById("memo-save-button")
    .addEventListener(
        "click",
        async () => {

            if (currentTempleNumber === null) {
                return;
            }

            const memo =
                document.getElementById(
                    "visit-memo"
                ).value;

            const memoStatus =
                document.getElementById(
                    "memo-status"
                );

            try {

                // ------------------------------
                // 現在のFirestoreデータを取得
                // ------------------------------

                const visitRef =
                    doc(
                        db,
                        "visits",
                        String(currentTempleNumber)
                            .padStart(3, "0")
                    );

                const snapshot =
                    await getDoc(visitRef);

                if (!snapshot.exists()) {

                    alert(
                        "先に訪問済みにしてください"
                    );

                    return;
                }

                const currentData =
                    snapshot.data();

                // ------------------------------
                // メモをFirestoreへ保存
                // ------------------------------

                await setDoc(
                    visitRef,
                    {
                        visited:
                            currentData.visited === true,

                        date:
                            currentData.date || "",

                        memo:
                            memo
                    }
                );

                memoStatus.textContent =
                    "メモを保存しました";

            } catch (error) {

                console.error(
                    "メモの保存に失敗しました:",
                    error
                );

                alert(
                    "メモの保存に失敗しました\n" +
                    error.message
                );
            }

        }
    );
    
document.getElementById("temple-search")
    .addEventListener(
        "input",
        (event) => {

            templeSearchText =
                event.target.value.trim();

            loadTemples();

        }
    );

document.getElementById("filter-all")
    .addEventListener(
        "click",
        () => setTempleFilter("all")
    );

document.getElementById("filter-unvisited")
    .addEventListener(
        "click",
        () => setTempleFilter("unvisited")
    );

document.getElementById("filter-visited")
    .addEventListener(
        "click",
        () => setTempleFilter("visited")
    );

// ========================================
// iPhone風ボトムシート
// 指に追従して3段階に切り替える
// ========================================
const detailSheet =
    document.getElementById("temple-detail");
let sheetTouchStartY = 0;
let sheetStartHeight = 0;
let isSheetDragging = false;
// ----------------------------------------
// シートの高さを取得
// ----------------------------------------
function getSheetHeight() {
    return detailSheet.getBoundingClientRect().height;
}
// ----------------------------------------
// スワイプ開始
// ----------------------------------------
detailSheet.addEventListener(
    "touchstart",
    (event) => {
        // 詳細画面が閉じている場合は無視
        if (
            detailSheet.classList.contains("hidden")
        ) {
            return;
        }
        sheetTouchStartY =
            event.touches[0].clientY;
        sheetStartHeight =
            getSheetHeight();
        isSheetDragging = true;
        // アニメーションを一旦OFF
        detailSheet.style.transition =
            "none";
    },
    { passive: true }
);
// ----------------------------------------
// 指を動かす
// ----------------------------------------
detailSheet.addEventListener(
    "touchmove",
    (event) => {
        if (!isSheetDragging) {
            return;
        }
        const currentY =
            event.touches[0].clientY;
        const deltaY =
            currentY - sheetTouchStartY;
        // 画面の高さ
        const screenHeight =
            window.innerHeight;
        // 現在の高さ
        let newHeight =
            sheetStartHeight - deltaY;
        // 高さの範囲
        const minHeight =
            screenHeight * 0.18;
        const maxHeight =
            screenHeight * 0.85;
        // 範囲内に制限
        newHeight =
            Math.max(
                minHeight,
                Math.min(
                    maxHeight,
                    newHeight
                )
            );
        // 高さを直接変更
        detailSheet.style.height =
            `${newHeight}px`;
    },
    { passive: true }
);
// ----------------------------------------
// 指を離す
// ----------------------------------------
detailSheet.addEventListener(
    "touchend",
    () => {
        if (!isSheetDragging) {
            return;
        }
        isSheetDragging = false;
        // アニメーションON
        detailSheet.style.transition =
            "height 0.25s ease";
        const screenHeight =
            window.innerHeight;
        const currentHeight =
            getSheetHeight();
        // --------------------------------
        // 3段階の高さ
        // --------------------------------
        const smallHeight =
            screenHeight * 0.22;
        const mediumHeight =
            screenHeight * 0.48;
        const largeHeight =
            screenHeight * 0.80;
        // --------------------------------
        // 一番近いサイズへ吸着
        // --------------------------------
        const heights = [
            {
                name: "small",
                height: smallHeight
            },
            {
                name: "medium",
                height: mediumHeight
            },
            {
                name: "large",
                height: largeHeight
            }
        ];
        let nearest =
            heights[0];
        let minDistance =
            Math.abs(
                currentHeight -
                nearest.height
            );
        heights.forEach(
            (item) => {
                const distance =
                    Math.abs(
                        currentHeight -
                        item.height
                    );
                if (
                    distance <
                    minDistance
                ) {
                    nearest =
                        item;
                    minDistance =
                        distance;
                }
            }
        );
        // --------------------------------
        // 状態を更新
        // --------------------------------
        detailSheet.classList.remove(
            "sheet-small",
            "sheet-medium",
            "sheet-large"
        );
        detailSheet.classList.add(
            `sheet-${nearest.name}`
        );
        // 高さを設定
        detailSheet.style.height =
            `${nearest.height}px`;
        // 少し待ってstyleを解除
        setTimeout(() => {
            detailSheet.style.height = "";
            detailSheet.style.transition = "";
        }, 250);
    },
    { passive: true }
);

// ========================================
// 開始
// ========================================
startVisitListener();
