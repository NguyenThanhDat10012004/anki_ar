import {loadGLTF} from "../libs/loader.js";
const THREE = window.MINDAR.IMAGE.THREE;
import {mockWithVideo, mockWithImage} from '../libs/camera-mock.js';

// 1. 🎯 ĐỊNH NGHĨA DỮ LIỆU GAME
const animalData = [
  { name: 'lion', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/animal/lion.glb', scene: null, position: {x: -0.4, y: 0, z: 0.1} },
  { name: 'ant', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/animal/ant.glb', scene: null, position: {x: -0.2, y: 0, z: 0.1} },
  { name: 'fox', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/animal/fox.glb', scene: null, position: {x: 0, y: 0, z: 0.1} },
  { name: 'snake', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/animal/snake.glb', scene: null, position: {x: 0.2, y: 0, z: 0.1} },
  { name: 'tiger', modelUrl: 'https://nguyenthanhdat10012004.github.io/anki_ar/data/animal/tiger.glb', scene: null, position: {x: 0.4, y: 0, z: 0.1} }
];

// 2. 🎮 BIẾN GAME
let currentWordToGuess = '';
let wrongAttempts = 0;
const MAX_ATTEMPTS = 3;
let remainingAnimals = [];

// 3. 🖥️ BIẾN UI (MỚI)
let statusMessageElement = null; // Sẽ lưu thẻ <div>

document.addEventListener('DOMContentLoaded', () => {
  // Lấy thẻ <div> từ HTML
  statusMessageElement = document.querySelector('#status-message');

  const start = async() => {
    // KHỞI TẠO MINDAR
    // mockWithImage("./anchor.jpg");
    const mindarThree = new window.MINDAR.IMAGE.MindARThree({
      container: document.body,
      imageTargetSrc: './target.mind',
    });
    const {renderer, scene, camera} = mindarThree;

    // THÊM ÁNH SÁNG
    const light = new THREE.HemisphereLight( 0xffffff, 0xbbbbff, 1 );
    scene.add(light);
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 2, 5);
    scene.add(pointLight);

    // TẢI 5 CON VẬT
    const anchor = mindarThree.addAnchor(0);
    await Promise.all(animalData.map(async (animal) => {
      try {
        const gltf = await loadGLTF(animal.modelUrl);
        animal.scene = gltf.scene;
        animal.scene.scale.set(0.05, 0.05, 0.05);
        animal.scene.position.set(animal.position.x, animal.position.y, animal.position.z);
        animal.scene.userData.name = animal.name; 
        anchor.group.add(animal.scene);
      } catch (err) { } // Bỏ qua log lỗi
    }));

    // THÊM TƯƠNG TÁC NHẤN
    const HITBOX_SIZE_PX = 100; 
    window.addEventListener('click', (event) => {
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
      if (clickedAnimalName) {
        checkAnswer(clickedAnimalName);
      }
    });

    // START MINDAR
    await mindarThree.start();
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });

    // BẮT ĐẦU GAME
    startGame();
  }

  // --- HÀM CẬP NHẬT UI (MỚI) ---
  function updateStatusMessage(message) {
    if (statusMessageElement) {
      statusMessageElement.innerHTML = message;
    }
    console.log(message); // Vẫn log ra console để bạn debug
  }


  // --- CÁC HÀM LOGIC GAME (Đã cập nhật) ---

  function startGame() {
    wrongAttempts = 0;
    remainingAnimals = animalData.map(a => a.name); 
    
    animalData.forEach(animal => {
        if (animal.scene) {
            animal.scene.visible = true;
        }
    });
    
    updateStatusMessage("Trò chơi bắt đầu!"); // THAY ĐỔI
    setTimeout(pickNewWord, 1000); // Chờ 1s rồi mới chọn từ
  }

  function pickNewWord() {
    if (remainingAnimals.length === 0) {
      updateStatusMessage("🎉 CHIẾN THẮNG! 🎉"); // THAY ĐỔI
      updateStatusMessage("Chơi lại sau 3 giây...");
      setTimeout(startGame, 3000); 
      return;
    }
    const randomIndex = Math.floor(Math.random() * remainingAnimals.length);
    currentWordToGuess = remainingAnimals[randomIndex];
    
    // Viết hoa chữ cái đầu
    const displayName = currentWordToGuess.charAt(0).toUpperCase() + currentWordToGuess.slice(1);
    updateStatusMessage(`Hãy tìm con: <strong>${displayName}</strong>`); // THAY ĐỔI
  }

  function checkAnswer(clickedAnimalName) {
    if (clickedAnimalName === currentWordToGuess) {
      // ĐÚNG
      updateStatusMessage("✔️ ĐÚNG RỒI!"); // THAY ĐỔI
      const foundIndex = remainingAnimals.findIndex(name => name === clickedAnimalName);
      if (foundIndex > -1) {
        remainingAnimals.splice(foundIndex, 1);
      }
      const animalObject = animalData.find(a => a.name === clickedAnimalName);
      if (animalObject && animalObject.scene) {
          animalObject.scene.visible = false; // Ẩn model đi
      }
      setTimeout(pickNewWord, 1000);
    } else {
      // SAI
      if (remainingAnimals.includes(clickedAnimalName)) {
        wrongAttempts++;
        updateStatusMessage(`❌ SAI RỒI! (${wrongAttempts}/${MAX_ATTEMPTS})`); // THAY ĐỔI
        
        if (wrongAttempts >= MAX_ATTEMPTS) {
          updateStatusMessage("THUA CUỘC!"); // THAY ĐỔI
          setTimeout(startGame, 2000);
        }
      } 
      // Không làm gì nếu nhấn vào con đã biến mất
    }
  }

  start();
});