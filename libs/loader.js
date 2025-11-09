// <-- THÊM DÒNG NÀY
import { DRACOLoader } from "./three.js-r132/examples/jsm/loaders/DRACOLoader.js"; 

import { GLTFLoader } from "./three.js-r132/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "./three.js-r132/build/three.module.js";

// --- BẮT ĐẦU PHẦN CẤU HÌNH DRACO ---
// 1. Khởi tạo DRACOLoader (chỉ 1 lần)
const dracoLoader = new DRACOLoader();

// 2. Chỉ đường dẫn đến thư mục chứa file giải nén (decoder)
// Cách dễ nhất là dùng CDN của Google
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
// --- KẾT THÚC PHẦN CẤU HÌNH DRACO ---


export const loadGLTF = (path) => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    // 3. (QUAN TRỌNG) Gắn bộ giải nén Draco vào GLTFLoader
    // Giờ đây, GLTFLoader biết cách giải nén file .glb của bạn
    loader.setDRACOLoader(dracoLoader); // <-- THÊM DÒNG NÀY

    loader.load(
      path, 
      (gltf) => { // Khi thành công
        resolve(gltf);
      },
      undefined, // (Không bắt buộc) Xử lý tiến trình
      (error) => { // Khi có lỗi
        reject(error); // <-- Thêm xử lý lỗi
      }
    );
  });
}

// (Các hàm loadAudio, loadVideo, loadTexture... giữ nguyên như cũ)

export const loadAudio = (path) => {
  return new Promise((resolve, reject) => {
    const loader = new THREE.AudioLoader();
    loader.load(path, (buffer) => {
      resolve(buffer);
    });
  });
}

export const loadVideo = (path) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.addEventListener('loadedmetadata', () => {
      video.setAttribute('playsinline', '');
      resolve(video);
    });
    video.src = path;
  });
}

export const loadTexture = (path) => {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(path, (texture) => {
      resolve(texture);
    }); 
  });
}

export const loadTextures = (paths) => {
  const loader = new THREE.TextureLoader();
  const promises = [];
  for (let i = 0; i < paths.length; i++) {
    promises.push(new Promise((resolve, reject) => {
      loader.load(paths[i], (texture) => {
        resolve(texture);
      }); 
    }));
  }
  return Promise.all(promises);
}