import {loadGLTF} from "../libs/loader.js";
const THREE = window.MINDAR.IMAGE.THREE;
import {mockWithVideo, mockWithImage} from '../libs/camera-mock.js';

// 1. 🎯 ĐỊNH NGHĨA DỮ LIỆU GAME
const animalData = [
  { name: 'lion', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/animal/lion.glb', scene: null },
  { name: 'ant', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/animal/ant.glb', scene: null },
  { name: 'fox', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/animal/fox.glb', scene: null },
  { name: 'snake', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/animal/snake.glb', scene: null },
  { name: 'tiger', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/animal/tiger.glb', scene: null }
];

const spawnPoints = [
  {x: -0.7, y: -0.22, z: 0.6}, 
  {x: -0.2, y: -0.22, z: 0.4}, 
  {x: 0.2, y: -0.22, z: -0.4}, 
  {x: 0.6, y: -0.22, z: 0.5},
  {x: -0.6, y: -0.22, z: -0.3} 
];

// 2. 🎮 BIẾN GAME (Global)
let currentWordToGuess = '';
let wrongAttempts = 0;
const MAX_ATTEMPTS = 3;
let remainingAnimals = [];
let score = 0;
let gameMode = 'text';
let isGameActive = false; // 👈 SỬA LỖI 2: Thêm cờ trạng thái game

// 3. 🖥️ BIẾN UI (Global)
let statusMessageElement = null;
let startScreen = null;
let endScreen = null;
let mindarThree = null;
let replayAudioBtn = null; 

// 4. 🔀 HÀM TIỆN ÍCH (Global)
function shuffleArray(array) {
  let currentIndex = array.length,  randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

const playAudio = (word) => {
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = "en-US";
        speechSynthesis.speak(utterance);
    } else {
        console.warn("Speech Synthesis API không được hỗ trợ.");
    }
};

function updateStatusMessage(message) {
    if (statusMessageElement) {
      statusMessageElement.innerHTML = message;
    }
    console.log(message); 
}

// 5. 🏠 HÀM QUẢN LÝ UI (Global)
const showScreen = (screenElement) => {
    [startScreen, endScreen].forEach(screen => {
        if (screen) screen.classList.add('hidden');
    });
    if (screenElement) {
        screenElement.classList.remove('hidden');
    }

    if (screenElement === startScreen || screenElement === endScreen) {
        document.body.classList.add('mindar-hidden');
    } else if (screenElement === null) {
        document.body.classList.remove('mindar-hidden');
    }
};

const showStartScreen = () => {
    showScreen(startScreen);
    updateStatusMessage("");
    replayAudioBtn.classList.add('hidden');
    isGameActive = false; // 👈 SỬA LỖI 2: Tắt cờ game khi ở màn hình bắt đầu
};

const showGameScreen = () => {
    showScreen(null); 
    startGame();
};

const showEndScreen = () => {
    showScreen(endScreen);
    updateStatusMessage(""); 
    replayAudioBtn.classList.add('hidden'); 
    isGameActive = false; // 👈 SỬA LỖI 2: Tắt cờ game khi ở màn hình kết thúc

    document.querySelector('#final-score').innerText = score;
    document.querySelector('#final-diamonds').innerText = score;
    document.querySelector('#final-hearts').innerText = MAX_ATTEMPTS - wrongAttempts;

    const endTitle = document.querySelector('#end-title');
    const starsDisplay = document.querySelector('#stars-display');
    starsDisplay.innerHTML = ''; 

    if (wrongAttempts >= MAX_ATTEMPTS) {
        endTitle.innerText = "THUA CUỘC!";
        endTitle.style.color = "#d9534f";
    } else {
        endTitle.innerText = "CHIẾN THẮNG!";
        endTitle.style.color = "#5cb85c";
        const numStars = MAX_ATTEMPTS - wrongAttempts;
        for (let i = 0; i < numStars; i++) {
            const starImg = document.createElement('img');
            starImg.src = "https://img.freepik.com/premium-vector/color-image-star-design-element-template-books-stickers-posters-cards-clothes_78007-10031.jpg?semt=ais_hybrid&w=740&q=80";
            starsDisplay.appendChild(starImg);
        }
    }
};

// 6. 🎮 HÀM LOGIC GAME (Global)
function startGame() {
    wrongAttempts = 0;
    score = 0;
    remainingAnimals = animalData.map(a => a.name); 
    
    const shuffledSpawnPoints = shuffleArray([...spawnPoints]);
    animalData.forEach((animal, index) => {
        if (animal.scene) {
            animal.scene.visible = true;
            const spawnPosition = shuffledSpawnPoints[index];
            animal.scene.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);
        }
    });
    
    updateStatusMessage("Trò chơi bắt đầu!");
    replayAudioBtn.classList.add('hidden'); 
    setTimeout(() => {
        pickNewWord();
        isGameActive = true; // 👈 SỬA LỖI 2: Bật cờ game sau khi từ mới được chọn
    }, 1000); 
}

function pickNewWord() {
    if (remainingAnimals.length === 0) {
        showEndScreen();
      return;
    }
    const randomIndex = Math.floor(Math.random() * remainingAnimals.length);
    currentWordToGuess = remainingAnimals[randomIndex];
    
    const displayName = currentWordToGuess.charAt(0).toUpperCase() + currentWordToGuess.slice(1);
    
    if (gameMode === 'voice') {
        updateStatusMessage(`Hãy lắng nghe và tìm con vật!`);
        playAudio(currentWordToGuess);
        replayAudioBtn.classList.remove('hidden'); 
    } else {
        updateStatusMessage(`Hãy tìm con: <strong>${displayName}</strong>`); 
        replayAudioBtn.classList.add('hidden'); 
    }
}

function checkAnswer(clickedAnimalName) {
    if (currentWordToGuess === '') return;

    if (clickedAnimalName === currentWordToGuess) {
      // ĐÚNG
      updateStatusMessage("✔️ ĐÚNG RỒI!"); 
        score += 100;
        currentWordToGuess = '';
        replayAudioBtn.classList.add('hidden'); 

      const foundIndex = remainingAnimals.findIndex(name => name === clickedAnimalName);
      if (foundIndex > -1) {
        remainingAnimals.splice(foundIndex, 1);
      }
      const animalObject = animalData.find(a => a.name === clickedAnimalName);
      if (animalObject && animalObject.scene) {
          animalObject.scene.visible = false;
      }
      setTimeout(pickNewWord, 1000);
    } else {
      // SAI
      wrongAttempts++;
      updateStatusMessage(`❌ SAI RỒI! (${wrongAttempts}/${MAX_ATTEMPTS})`); 
      
      if (wrongAttempts >= MAX_ATTEMPTS) {
        showEndScreen();
      }
    }
}


// 7. 🚀 KHỞI ĐỘNG ỨNG DỤNG
document.addEventListener('DOMContentLoaded', () => {
  // Gán giá trị cho các biến UI global
  statusMessageElement = document.querySelector('#status-message');
  startScreen = document.querySelector('#start-screen');
  endScreen = document.querySelector('#end-screen');
  replayAudioBtn = document.querySelector('#replay-audio-btn'); 
  
  // Gán sự kiện cho các nút UI
  document.querySelector('#start-new-game-btn').addEventListener('click', () => {
    gameMode = 'text';
    showGameScreen();
  });
  document.querySelector('#start-voice-game-btn').addEventListener('click', () => {
    gameMode = 'voice';
    showGameScreen();
  });
  document.querySelector('#play-again-btn').addEventListener('click', () => {
    showGameScreen();
  });
  document.querySelector('#select-mode-btn').addEventListener('click', () => {
    showStartScreen();
  });
  document.querySelector('#home-btn').addEventListener('click', () => {
    showStartScreen(); 
  });
  document.querySelector('#exit-btn').addEventListener('click', () => {
    alert("Thoát game!"); 
  });
  replayAudioBtn.addEventListener('click', () => {
      if (currentWordToGuess !== '') {
          playAudio(currentWordToGuess);
      }
  });

  // --- HÀM START CHÍNH CỦA ỨNG DỤNG ---
  const start = async() => {
    // KHỞI TẠO MINDAR
    mindarThree = new window.MINDAR.IMAGE.MindARThree({
      container: document.body, 
      imageTargetSrc: './targets.mind',
      uiScanning: "no",
      uiLoading: "no"
   });
    const {renderer, scene, camera} = mindarThree;

    // THIẾT LẬP CẢNH 3D
    const light = new THREE.HemisphereLight( 0xffffff, 0xbbbbff, 1 );
    scene.add(light);
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 2, 5);
    scene.add(pointLight);
    const anchor = mindarThree.addAnchor(0);

    // TẢI TÀI SẢN 3D (Models)
    try {
      const zooGltf = await loadGLTF('./zoo.glb');
      zooGltf.scene.scale.set(1, 1, 1); 
      zooGltf.scene.position.set(0, 0, 0); 
      anchor.group.add(zooGltf.scene);
    } catch (err) {
      console.error("LỖI TẢI SỞ THÚ:", err);
    }
    await Promise.all(animalData.map(async (animal) => {
      try {
        const gltf = await loadGLTF(animal.modelUrl);
        animal.scene = gltf.scene;
        animal.scene.scale.set(0.1, 0.1, 0.1); 
        animal.scene.rotation.set( 0, 0, 0);
        animal.scene.userData.name = animal.name; 
        anchor.group.add(animal.scene);
        animal.scene.visible = false;
      } catch (err) { console.log(err) } 
    }));

    // THIẾT LẬP TƯƠNG TÁC CLICK
    const HITBOX_SIZE_PX = 100; 
    window.addEventListener('click', (event) => {
      if (event.target.id === 'replay-audio-btn') {
          return;
      }

      // 👈 SỬA LỖI 2: Thêm kiểm tra 'isGameActive'
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
          
          const isHit = 
            clickX >= screenX - HITBOX_SIZE_PX / 2 &&
            clickX <= screenX + HITBOX_SIZE_PX / 2 &&
            clickY >= screenY - HITBOX_SIZE_PX / 2 &&
            clickY <= screenY + HITBOX_SIZE_PX / 2;
          
          if (isHit) {
            clickedAnimalName = animal.name;
            break; 
          }
        }
        checkAnswer(clickedAnimalName); 
      }
    });

    // VÒNG LẶP RENDER
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });

    // Khởi động AR 1 LẦN DUY NHẤT
    await mindarThree.start();

    // BẮT ĐẦU VỚI MÀN HÌNH KHỞI ĐỘNG
    // (Việc này chỉ chạy sau khi 'await' ở trên đã xong)
    showStartScreen();
  }

  // Chạy hàm start chính
  start();
});
