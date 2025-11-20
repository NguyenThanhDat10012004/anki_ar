import { loadGLTF } from "../libs/loader.js";
const THREE = window.MINDAR.IMAGE.THREE;

// 1. 🎯 ĐỊNH NGHĨA DỮ LIỆU GAME
const animalData = [
    { name: 'lion', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/travel/beach.glb', scene: null, offset: 0 },
    { name: 'ant', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/travel/hotel.glb', scene: null, offset: 0 },
    { name: 'fox', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/travel/luggage.glb', scene: null, offset: 0 },
    { name: 'snake', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/travel/map.glb', scene: null, offset: 0 },
    { name: 'tiger', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/travel/passport.glb', scene: null, offset: 0 }
];

let link_glb = "./zoo.glb";
let mapScene = null;

// 2. 🎮 BIẾN GAME (Global)
let currentWordToGuess = '';
let wrongAttempts = 0;
const MAX_ATTEMPTS = 3;
let remainingAnimals = [];
let score = 0;
let gameMode = 'text';
let isGameActive = false;

// 3. 🖥️ BIẾN UI (Global)
let statusMessageElement = null;
let startScreen = null;
let endScreen = null;
let mindarThree = null;
let replayAudioBtn = null;

// 4. 🔀 HÀM TIỆN ÍCH
const playAudio = (word) => {
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = "en-US";
        speechSynthesis.speak(utterance);
    }
};

function updateStatusMessage(message) {
    if (statusMessageElement) statusMessageElement.innerHTML = message;
}

function calculateFootOffset(modelScene) {
    const box = new THREE.Box3().setFromObject(modelScene);
    return -box.min.y; 
}

// --- 🔥 MỚI: HÀM SCALE THEO PHẦN TRĂM BACKGROUND ---
// Hàm này lấy kích thước background làm chuẩn, rồi set model bằng bao nhiêu % của nó
function scaleByBackgroundRatio(model, backgroundScene, percentage) {
    if (!backgroundScene || !model) return;

    // 1. Cập nhật lại ma trận để đảm bảo số đo chính xác
    backgroundScene.updateMatrixWorld(true);
    model.updateMatrixWorld(true);

    // 2. Đo background
    const bgBox = new THREE.Box3().setFromObject(backgroundScene);
    const bgSize = new THREE.Vector3();
    bgBox.getSize(bgSize);
    const bgMaxDim = Math.max(bgSize.x, bgSize.y, bgSize.z);

    // 3. Đo Model
    const modelBox = new THREE.Box3().setFromObject(model);
    const modelSize = new THREE.Vector3();
    modelBox.getSize(modelSize);
    const modelMaxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);

    // 4. Tính toán kích thước đích
    // Nếu background chưa load xong (size=0) thì lấy tạm 1 đơn vị làm chuẩn
    const targetSize = (bgMaxDim > 0 ? bgMaxDim : 1) * percentage;

    // 5. Áp dụng Scale an toàn
    if (modelMaxDim > 0.001) { // Chỉ scale nếu model có kích thước thực tế
        let scaleFactor = targetSize / modelMaxDim;
        
        // 🛑 CHẶN LỖI: Nếu tỉ lệ phóng quá 1000 lần (do model gốc quá bé),
        // ta sẽ ép nó về 1 con số hợp lý hơn để tránh nổ màn hình.
        if (scaleFactor > 1000) scaleFactor = 1; 

        model.scale.set(scaleFactor, scaleFactor, scaleFactor);
    } else {
        // Nếu không đo được kích thước (lỗi file 3D), set về mức an toàn
        model.scale.set(0.5, 0.5, 0.5);
    }
}

// --- 🛠️ HÀM DÒ TÌM VỊ TRÍ ---
const raycaster = new THREE.Raycaster();

function isColliding(modelScene, position, existingBoxes) {
    const originalPos = modelScene.position.clone();
    modelScene.position.copy(position);
    modelScene.updateMatrixWorld(true);
    const currentBox = new THREE.Box3().setFromObject(modelScene);
    currentBox.expandByScalar(0.02); 
    modelScene.position.copy(originalPos);
    modelScene.updateMatrixWorld(true);

    for (const box of existingBoxes) {
        if (currentBox.intersectsBox(box)) return true;
    }
    return false;
}

function findSafeSpawnPosition(modelScene, existingBoxes, footOffset) {
    const RANGE_X = 0.8; 
    const RANGE_Z = 0.5; 
    const MAX_RETRIES = 50; 
    
    // 1. Định nghĩa độ cao "Đất" (để lọc trong vòng lặp)
    // Những gì thấp hơn 0.1 thì coi là đất, cao hơn thì coi là bàn/cây -> Bỏ qua ở bước này
    const MAX_GROUND_HEIGHT = 0.1; 

    // --- GIAI ĐOẠN 1: CỐ TÌM VỊ TRÍ DƯỚI ĐẤT (50 lần) ---
    for (let i = 0; i < MAX_RETRIES; i++) {
        const localRandX = (Math.random() - 0.5) * 2 * RANGE_X;
        const localRandZ = (Math.random() - 0.5) * 2 * RANGE_Z;
        
        // Bắn từ rất cao xuống
        const localOrigin = new THREE.Vector3(localRandX, 5, localRandZ); 
        const localDirection = new THREE.Vector3(0, -1, 0);

        const worldOrigin = localOrigin.clone().applyMatrix4(mapScene.matrixWorld);
        const worldDirection = localDirection.clone().transformDirection(mapScene.matrixWorld).normalize();

        raycaster.set(worldOrigin, worldDirection);
        const intersects = raycaster.intersectObject(mapScene, true);

        if (intersects.length > 0) {
            const hitObject = intersects[0];
            const localHitPoint = mapScene.worldToLocal(hitObject.point.clone());

            // 🔥 ĐIỀU KIỆN QUAN TRỌNG: 
            // Nếu vị trí tìm thấy CAO hơn mặt đất quy định (ví dụ trúng mặt bàn hoặc cây)
            // -> BỎ QUA, tìm tiếp chỗ khác thấp hơn.
            if (localHitPoint.y > MAX_GROUND_HEIGHT) {
                continue; 
            }

            // Check độ phẳng (để không đứng nghiêng)
            if (hitObject.face) {
                const normal = hitObject.face.normal.clone();
                normal.transformDirection(hitObject.object.matrixWorld);
                if (normal.y < 0.8) continue; 
            }

            // Nếu tìm được chỗ đất ngon lành:
            const finalPosition = new THREE.Vector3(localHitPoint.x, localHitPoint.y + footOffset, localHitPoint.z);

            if (!isColliding(modelScene, finalPosition, existingBoxes)) {
                // ... Code lưu box giữ nguyên ...
                const tempPos = modelScene.position.clone();
                modelScene.position.copy(finalPosition);
                modelScene.updateMatrixWorld(true);
                const validBox = new THREE.Box3().setFromObject(modelScene);
                validBox.expandByScalar(0.02);
                modelScene.position.copy(tempPos); 
                return { success: true, position: finalPosition, box: validBox }; 
            }
        }
    }

    // --- GIAI ĐOẠN 2: FALLBACK (Khi 50 lần tìm đất thất bại) ---
    // Lúc này ta chấp nhận đặt lên MẶT BÀN (vị trí cao nhất tìm thấy)
    
    // Random lại một tọa độ bất kỳ
    const fallbackX = (Math.random() - 0.5) * 2 * (RANGE_X - 0.1);
    const fallbackZ = (Math.random() - 0.5) * 2 * (RANGE_Z - 0.1);
    
    // Ta lại dùng Raycaster một lần nữa tại vị trí này để tìm mặt bàn
    const localOrigin = new THREE.Vector3(fallbackX, 5, fallbackZ); // Bắn từ cao xuống
    const localDirection = new THREE.Vector3(0, -1, 0);
    
    const worldOrigin = localOrigin.clone().applyMatrix4(mapScene.matrixWorld);
    const worldDirection = localDirection.clone().transformDirection(mapScene.matrixWorld).normalize();
    
    raycaster.set(worldOrigin, worldDirection);
    const intersects = raycaster.intersectObject(mapScene, true);
    
    let fallbackPos;

    if (intersects.length > 0) {
        // 🔥 MẤU CHỐT Ở ĐÂY:
        // Lấy điểm chạm đầu tiên (chính là điểm cao nhất - tức là mặt bàn hoặc ngọn cây)
        // Và ta CHẤP NHẬN nó luôn, không check độ cao nữa.
        const hitObject = intersects[0];
        const localHitPoint = mapScene.worldToLocal(hitObject.point.clone());
        
        // Đặt vật lên điểm cao đó (Mặt bàn)
        fallbackPos = new THREE.Vector3(localHitPoint.x, localHitPoint.y + footOffset, localHitPoint.z);
    } else {
        // Trường hợp xấu nhất không bắn trúng gì cả -> Về 0
        fallbackPos = new THREE.Vector3(fallbackX, footOffset, fallbackZ);
    }

    // ... Code trả về fallback giữ nguyên ...
    const tempPos = modelScene.position.clone();
    modelScene.position.copy(fallbackPos);
    modelScene.updateMatrixWorld(true);
    const fallbackBox = new THREE.Box3().setFromObject(modelScene);
    modelScene.position.copy(tempPos);

    return { success: false, position: fallbackPos, box: fallbackBox };
}

// 5. 🏠 QUẢN LÝ UI
const showScreen = (screenElement) => {
    [startScreen, endScreen].forEach(s => s && s.classList.add('hidden'));
    if (screenElement) screenElement.classList.remove('hidden');
    if (screenElement === startScreen || screenElement === endScreen) document.body.classList.add('mindar-hidden');
    else if (screenElement === null) document.body.classList.remove('mindar-hidden');
};

const showStartScreen = () => { 
    showScreen(startScreen); 
    updateStatusMessage(""); 
    replayAudioBtn.classList.add('hidden'); 
    isGameActive = false; 
};

const showGameScreen = () => { 
    showScreen(null); 
    startGame(); 
};

const showEndScreen = () => { 
    showScreen(endScreen);
    updateStatusMessage(""); 
    replayAudioBtn.classList.add('hidden'); 
    isGameActive = false;
    
    if(document.querySelector('#final-score')) document.querySelector('#final-score').innerText = score;
    if(document.querySelector('#final-diamonds')) document.querySelector('#final-diamonds').innerText = score;
    if(document.querySelector('#final-hearts')) document.querySelector('#final-hearts').innerText = MAX_ATTEMPTS - wrongAttempts;

    const endTitle = document.querySelector('#end-title');
    const starsDisplay = document.querySelector('#stars-display');
    if(starsDisplay) starsDisplay.innerHTML = '';

    if (wrongAttempts >= MAX_ATTEMPTS) {
        if(endTitle) {
            endTitle.innerText = "THUA CUỘC!";
            endTitle.style.color = "#d9534f";
        }
    } else {
        if(endTitle) {
            endTitle.innerText = "CHIẾN THẮNG!";
            endTitle.style.color = "#5cb85c";
        }
        if(starsDisplay) {
            const numStars = MAX_ATTEMPTS - wrongAttempts;
            for (let i = 0; i < numStars; i++) {
                const starImg = document.createElement('img');
                starImg.src = "https://img.freepik.com/premium-vector/color-image-star-design-element-template-books-stickers-posters-cards-clothes_78007-10031.jpg?semt=ais_hybrid&w=740&q=80";
                starsDisplay.appendChild(starImg);
            }
        }
    }
};

// --- 🎮 HÀM START GAME ---
function startGame() {
    wrongAttempts = 0;
    score = 0;
    remainingAnimals = [];
    updateStatusMessage("Đang tìm vị trí...");
    replayAudioBtn.classList.add('hidden');

    const occupiedBoxes = []; 
    if (mapScene) mapScene.updateMatrixWorld(true);

    animalData.forEach((animal) => {
        if (animal.scene && mapScene) {
            animal.scene.visible = false;
            
            // Logic tìm vị trí (Scale đã được xử lý lúc load rồi)
            const result = findSafeSpawnPosition(animal.scene, occupiedBoxes, animal.offset);
            
            if (result) {
                animal.scene.position.copy(result.position);
                animal.scene.rotation.y = 0; 
                animal.scene.visible = true;
                occupiedBoxes.push(result.box);
                remainingAnimals.push(animal.name);
            }
        }
    });

    if (remainingAnimals.length > 0) {
        updateStatusMessage("Trò chơi bắt đầu!");
        setTimeout(() => {
            pickNewWord();
            isGameActive = true;
        }, 1000);
    } else {
        updateStatusMessage("Lỗi: Không tìm thấy mặt đất. Hãy thử lại!");
    }
}

function pickNewWord() { 
    if (remainingAnimals.length === 0) { showEndScreen(); return; }
    const randomIndex = Math.floor(Math.random() * remainingAnimals.length);
    currentWordToGuess = remainingAnimals[randomIndex];
    const displayName = currentWordToGuess.charAt(0).toUpperCase() + currentWordToGuess.slice(1);
    if (gameMode === 'voice') {
        updateStatusMessage(`Hãy lắng nghe và tìm vật!`);
        playAudio(currentWordToGuess);
        replayAudioBtn.classList.remove('hidden');
    } else {
        updateStatusMessage(`Hãy tìm: <strong>${displayName}</strong>`);
        replayAudioBtn.classList.add('hidden');
    }
}

function checkAnswer(clickedAnimalName) { 
    if (currentWordToGuess === '') return;
    
    if (clickedAnimalName === currentWordToGuess) {
        updateStatusMessage("✔️ ĐÚNG RỒI!");
        score += 100;
        currentWordToGuess = '';
        replayAudioBtn.classList.add('hidden');
        const foundIndex = remainingAnimals.findIndex(name => name === clickedAnimalName);
        if (foundIndex > -1) remainingAnimals.splice(foundIndex, 1);
        const animalObject = animalData.find(a => a.name === clickedAnimalName);
        if (animalObject && animalObject.scene) animalObject.scene.visible = false;
        setTimeout(pickNewWord, 1000);
    } else {
        wrongAttempts++;
        updateStatusMessage(`❌ SAI RỒI! (${wrongAttempts}/${MAX_ATTEMPTS})`);
        if (wrongAttempts >= MAX_ATTEMPTS) showEndScreen();
    }
}

// 7. 🚀 KHỞI ĐỘNG ỨNG DỤNG
document.addEventListener('DOMContentLoaded', () => {
    statusMessageElement = document.querySelector('#status-message');
    startScreen = document.querySelector('#start-screen');
    endScreen = document.querySelector('#end-screen');
    replayAudioBtn = document.querySelector('#replay-audio-btn');
    
    document.querySelector('#start-new-game-btn').addEventListener('click', () => { gameMode = 'text'; showGameScreen(); });
    document.querySelector('#start-voice-game-btn').addEventListener('click', () => { gameMode = 'voice'; showGameScreen(); });
    document.querySelector('#play-again-btn').addEventListener('click', () => showGameScreen());
    document.querySelector('#select-mode-btn').addEventListener('click', () => showStartScreen());
    document.querySelector('#home-btn').addEventListener('click', () => showStartScreen());
    document.querySelector('#exit-btn').addEventListener('click', () => alert("Thoát game!"));
    replayAudioBtn.addEventListener('click', () => { if (currentWordToGuess) playAudio(currentWordToGuess); });

    const start = async () => {
        mindarThree = new window.MINDAR.IMAGE.MindARThree({
            container: document.body,
            imageTargetSrc: './targets.mind',
            uiScanning: "no", uiLoading: "no"
        });
        const { renderer, scene, camera } = mindarThree;

        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        scene.add(light);
        const pointLight = new THREE.PointLight(0xffffff, 1, 100);
        pointLight.position.set(0, 5, 5);
        scene.add(pointLight);
        
        const anchor = mindarThree.addAnchor(0);

        try {
            const zooGltf = await loadGLTF(link_glb);
            zooGltf.scene.scale.set(1, 1, 1);
            zooGltf.scene.position.set(0, 0, 0);
            mapScene = zooGltf.scene; 
            anchor.group.add(zooGltf.scene);
        } catch (err) { console.error("LỖI TẢI MAP:", err); }
        
        await Promise.all(animalData.map(async (animal) => {
            try {
                const gltf = await loadGLTF(animal.modelUrl);
                animal.scene = gltf.scene;
                
                // --- 🔥 THAY ĐỔI Ở ĐÂY ---
                // Truyền vào 0.02 tức là 2%
                // Nếu vẫn to/nhỏ, bạn chỉ cần sửa số 0.02 này (ví dụ 0.05 là 5%, 0.01 là 1%)
                scaleByBackgroundRatio(animal.scene, mapScene, 0.15); 

                animal.scene.userData.name = animal.name; 
                anchor.group.add(animal.scene);
                animal.offset = calculateFootOffset(animal.scene);
                animal.scene.visible = false;
            } catch (err) { console.log(err) }
        }));

        const HITBOX_SIZE_PX = 100; 
        window.addEventListener('click', (event) => {
            if (event.target.id === 'replay-audio-btn') return;
            if (isGameActive && startScreen.classList.contains('hidden') && endScreen.classList.contains('hidden')) {
                const clickX = event.clientX;
                const clickY = event.clientY;
                let clickedAnimalName = null;
                
                for (const animal of animalData) {
                    if (!animal.scene || !animal.scene.visible) continue;
                    const worldPosition = new THREE.Vector3();
                    animal.scene.getWorldPosition(worldPosition);
                    const screenPosition = worldPosition.clone().project(camera);
                    if (screenPosition.z > 1) continue;
                    const screenX = (screenPosition.x + 1) / 2 * window.innerWidth;
                    const screenY = (-screenPosition.y + 1) / 2 * window.innerHeight;
                    const isHit = Math.abs(clickX - screenX) < HITBOX_SIZE_PX/2 && Math.abs(clickY - screenY) < HITBOX_SIZE_PX/2;
                    if (isHit) { clickedAnimalName = animal.name; break; }
                }
                // Logic: Ấn ra ngoài (null) vẫn gọi checkAnswer -> Tính là Sai
                checkAnswer(clickedAnimalName);
            }
        });

        renderer.setAnimationLoop(() => renderer.render(scene, camera));
        await mindarThree.start();
        showStartScreen();
    }
    start();
});