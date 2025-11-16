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

// ⬇️ MỚI: Định nghĩa các vị trí có thể xuất hiện bên trong sở thú
const spawnPoints = [
  // 1. Trong khu vực vòng tròn màu vàng (phía trước, bên trái)
  {x: -0.7, y: -0.22, z: 0.6}, 
  // 2. Trên đường đá (gần trung tâm, phía trước)
  {x: -0.2, y: -0.22, z: 0.4}, 
  // 3. Ngay trước ngôi nhà màu hồng (phía sau, trung tâm)
  {x: 0.2, y: -0.22, z: -0.4}, 
  // 4. Trên đường đá (phía trước, bên phải, gần hình nón)
  {x: 0.6, y: -0.22, z: 0.5},
  // 5. Khu vực trống bên trái ngôi nhà (phía sau, bên trái)
  {x: -0.6, y: -0.22, z: -0.3} 
];

// 2. 🎮 BIẾN GAME
let currentWordToGuess = '';
let wrongAttempts = 0;
const MAX_ATTEMPTS = 3;
let remainingAnimals = [];

// 3. 🖥️ BIẾN UI
let statusMessageElement = null;

// ⬇️ MỚI: Hàm xáo trộn mảng (Fisher-Yates shuffle)
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


document.addEventListener('DOMContentLoaded', () => {
  statusMessageElement = document.querySelector('#status-message');

  const start = async() => {
    // KHỞI TẠO MINDAR
    const mindarThree = new window.MINDAR.IMAGE.MindARThree({
      container: document.body,
      imageTargetSrc: './targets.mind',
    });
    const {renderer, scene, camera} = mindarThree;

    // THÊM ÁNH SÁNG
    const light = new THREE.HemisphereLight( 0xffffff, 0xbbbbff, 1 );
    scene.add(light);
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 2, 5);
    scene.add(pointLight);

    // TẠO ANCHOR
    const anchor = mindarThree.addAnchor(0);

    // ⬇️ MỚI: TẢI SỞ THÚ (ZOO)
    try {
      const zooGltf = await loadGLTF('./zoo.glb');
      zooGltf.scene.scale.set(1, 1, 1); 
      zooGltf.scene.position.set(0, 0, 0); 
      anchor.group.add(zooGltf.scene);
    } catch (err) {
      console.error("LỖI TẢI SỞ THÚ:", err);
d    }

    // ⬇️ MỚI: Xáo trộn các vị trí spawn
    const shuffledSpawnPoints = shuffleArray([...spawnPoints]); 

    // TẢI 5 CON VẬT VÀO VỊ TRÍ NGẪU NHIÊN
    await Promise.all(animalData.map(async (animal, index) => {
      try {
        const gltf = await loadGLTF(animal.modelUrl);
        animal.scene = gltf.scene;
        animal.scene.scale.set(0.1, 0.1, 0.1); 

        const spawnPosition = shuffledSpawnPoints[index];
        animal.scene.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);
        
        animal.scene.rotation.set( 0, 0, 0);
        animal.scene.userData.name = animal.name; 
        anchor.group.add(animal.scene);
      } catch (err) { } 
    }));

    // THÊM TƯƠNG TÁC NHẤN
    const HITBOX_SIZE_PX = 100; 
    window.addEventListener('click', (event) => {
      const clickX = event.clientX;
      const clickY = event.clientY;
      let clickedAnimalName = null;
      
      for (const animal of animalData) {
        // Bỏ qua nếu con vật đã bị ẩn
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
      
      // ⚠️ THAY ĐỔI SỐ 1:
      // Luôn gọi checkAnswer, dù clickedAnimalName là 'tiger' hay 'null' (bấm ra ngoài)
      checkAnswer(clickedAnimalName);
    });

    // START MINDAR
    await mindarThree.start();
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });

    // BẮT ĐẦU GAME
    startGame();
  }

  // --- HÀM CẬP NHẬT UI ---
  function updateStatusMessage(message) {
    if (statusMessageElement) {
      statusMessageElement.innerHTML = message;
    }
    console.log(message); 
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
    
    updateStatusMessage("Trò chơi bắt đầu!");
    setTimeout(pickNewWord, 1000); 
  }

  function pickNewWord() {
    if (remainingAnimals.length === 0) {
      updateStatusMessage("🎉 CHIẾN THẮNG! 🎉");
      updateStatusMessage("Chơi lại sau 3 giây...");
      setTimeout(startGame, 3000); 
      return;
    }
    const randomIndex = Math.floor(Math.random() * remainingAnimals.length);
    currentWordToGuess = remainingAnimals[randomIndex];
    
    const displayName = currentWordToGuess.charAt(0).toUpperCase() + currentWordToGuess.slice(1);
    updateStatusMessage(`find : <strong>${displayName}</strong>`); 
  }

  // ⚠️ THAY ĐỔI SỐ 2: Cập nhật hàm checkAnswer
  function checkAnswer(clickedAnimalName) {
    if (clickedAnimalName === currentWordToGuess) {
      // ĐÚNG
      updateStatusMessage("✔️ ĐÚNG RỒI!"); 
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
      // Giờ đây, bất kỳ cú click nào không đúng (kể cả 'null') đều sẽ vào đây
      wrongAttempts++;
      updateStatusMessage(`❌ SAI RỒI! (${wrongAttempts}/${MAX_ATTEMPTS})`); 
      
      if (wrongAttempts >= MAX_ATTEMPTS) {
        updateStatusMessage("THUA CUỘC!"); 
        setTimeout(startGame, 2000);
      }
    }
  }

  start();
});