import {mockWithVideo} from '../../libs/camera-mock.js';
import {loadGLTF} from "../../libs/loader.js"; 

const THREE = window.MINDAR.FACE.THREE;

document.addEventListener('DOMContentLoaded', () => {
  const start = async() => {
    const mindarThree = new window.MINDAR.FACE.MindARThree({
      container: document.body,
    });
    const {renderer, scene, camera} = mindarThree;

    const light = new THREE.HemisphereLight( 0xffffff, 0xbbbbff, 1 );
    scene.add(light);

    const model = await loadGLTF('https://nguyenthanhdat10012004.github.io/anki_ar/data/animal/lion.glb');
    let initialModelScale = 0.2; 
    model.scene.scale.set(initialModelScale, initialModelScale, initialModelScale); 
    model.scene.position.set(-1, 0, 0); 

    const anchor = mindarThree.addAnchor(1);
    anchor.group.add(model.scene);

    // ============================================================
    // === 1. TẠO NÚT ĐỔI CAMERA (SWITCH CAMERA) ===
    // ============================================================
    const switchButton = document.createElement("button");
    switchButton.innerText = "Đổi Camera";
    // Style cho nút nằm ở góc trên bên phải
    Object.assign(switchButton.style, {
        position: "absolute",
        top: "10px",
        right: "10px",
        zIndex: "1000",
        padding: "10px 20px",
        backgroundColor: "#ff5722",
        color: "white",
        border: "none",
        borderRadius: "5px",
        fontSize: "16px",
        cursor: "pointer"
    });
    document.body.appendChild(switchButton);

    // Sự kiện khi bấm nút -> Chuyển Camera
    switchButton.addEventListener("click", () => {
        mindarThree.switchCamera();
    });

    // ============================================================
    // === 2. LOGIC XOAY & ZOOM (GIỮ NGUYÊN) ===
    // ============================================================
    
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let initialPinchDistance = 0; 
    let isPinching = false;       

    const getClientPos = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    const getPinchDistance = (e) => {
        if (e.touches && e.touches.length >= 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }
        return 0;
    };

    const onStart = (e) => {
        if (e.touches && e.touches.length >= 2) {
            isPinching = true;
            initialPinchDistance = getPinchDistance(e);
            isDragging = false; 
        } else if (e.touches && e.touches.length === 1 || !e.touches) { 
            isDragging = true;
            isPinching = false;
            previousMousePosition = getClientPos(e);
        }
    };

    const onMove = (e) => {
        if(e.cancelable) e.preventDefault(); 

        if (isPinching && e.touches && e.touches.length >= 2) {
            const currentPinchDistance = getPinchDistance(e);
            if (initialPinchDistance === 0) { 
                 initialPinchDistance = currentPinchDistance;
                 return;
            }
            const scaleFactor = currentPinchDistance / initialPinchDistance;
            let newScale = initialModelScale * scaleFactor;
            newScale = Math.max(0.05, Math.min(newScale, 0.5)); 

            model.scene.scale.set(newScale, newScale, newScale);
            
        } else if (isDragging) {
            const currentPos = getClientPos(e);
            const deltaMove = {
                x: currentPos.x - previousMousePosition.x,
                y: currentPos.y - previousMousePosition.y
            };
            model.scene.rotation.y += deltaMove.x * 0.01;
            previousMousePosition = currentPos;
        }
    };

    const onEnd = (e) => {
        if (isPinching && (!e.touches || e.touches.length < 2)) {
            isPinching = false;
            initialPinchDistance = 0;
            initialModelScale = model.scene.scale.x; 
        }
        if (isDragging) {
            isDragging = false;
        }
    };

    document.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);

    // ============================================================

    await mindarThree.start();
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });
  }
  start();
});