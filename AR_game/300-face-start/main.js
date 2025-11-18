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
    // Lưu trữ scale ban đầu của model
    let initialModelScale = 0.2; 
    model.scene.scale.set(initialModelScale, initialModelScale, initialModelScale); 
    model.scene.position.set(-1, 0, 0); 

    const anchor = mindarThree.addAnchor(1);
    anchor.group.add(model.scene);

    // ============================================================
    // === PHẦN LOGIC XOAY & ZOOM (HỖ TRỢ CẢ MOBILE & PC) ===
    // ============================================================
    
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    let initialPinchDistance = 0; // Khoảng cách giữa 2 ngón tay khi bắt đầu chạm
    let isPinching = false;       // Cờ kiểm tra đang pinch hay không

    // Hàm lấy tọa độ X, Y dù là chuột hay cảm ứng
    const getClientPos = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    // Hàm tính khoảng cách giữa 2 điểm chạm (cho Pinch-to-Zoom)
    const getPinchDistance = (e) => {
        if (e.touches && e.touches.length >= 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }
        return 0;
    };

    // 1. Bắt đầu chạm/nhấn
    const onStart = (e) => {
        // Kiểm tra nếu có 2 ngón tay chạm -> bắt đầu pinch
        if (e.touches && e.touches.length >= 2) {
            isPinching = true;
            initialPinchDistance = getPinchDistance(e);
            // reset kéo khi đang pinch
            isDragging = false; 
        } else if (e.touches && e.touches.length === 1 || !e.touches) { // 1 ngón tay hoặc chuột
            isDragging = true;
            isPinching = false;
            previousMousePosition = getClientPos(e);
        }
    };

    // 2. Di chuyển ngón tay/chuột
    const onMove = (e) => {
        // Ngăn màn hình bị cuộn khi đang xoay/zoom
        if(e.cancelable) e.preventDefault(); 

        if (isPinching && e.touches && e.touches.length >= 2) {
            const currentPinchDistance = getPinchDistance(e);
            if (initialPinchDistance === 0) { // Trường hợp pinch mới bắt đầu nhưng chưa có khoảng cách cũ
                 initialPinchDistance = currentPinchDistance;
                 return;
            }

            const scaleFactor = currentPinchDistance / initialPinchDistance;
            
            // Tính toán scale mới, giới hạn trong khoảng min/max
            // Ví dụ: min 0.05, max 0.5. Bạn có thể thay đổi các giá trị này.
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

    // 3. Kết thúc chạm/nhấn
    const onEnd = (e) => {
        // Nếu kết thúc pinch (có thể còn 1 ngón tay)
        if (isPinching && (!e.touches || e.touches.length < 2)) {
            isPinching = false;
            initialPinchDistance = 0;
            // Cập nhật lại initialModelScale sau khi zoom để dùng cho lần zoom tiếp theo
            initialModelScale = model.scene.scale.x; 
        }
        // Nếu kết thúc kéo (chuột hoặc 1 ngón tay)
        if (isDragging) {
            isDragging = false;
        }
    };

    // --- Gán sự kiện cho cả Chuột (PC) ---
    document.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    // --- Gán sự kiện cho Cảm ứng (Mobile) ---
    document.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd); // touchend không cần passive: false

    // ============================================================

    await mindarThree.start();
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });
  }
  start();
});