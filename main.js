import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const light = new THREE.AmbientLight(0xffffff); // soft white light
scene.add(light);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
const viewer = document.getElementById('canvas_viewer');
viewer.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);

camera.position.z = 5;
controls.update();

const loader = new GLTFLoader();
let meshObj;
let mouseDown = false;
let eraseMode = false;
const eraseMessage = document.getElementById('erase_mode');

loader.load('./2011HondaOdysseyScan1.glb', function (gltf) {
    meshObj = gltf.scene.children[0];
    scene.add(meshObj);

}, undefined, function (error) {

    console.error(error);

});

function generatePointerOffsets(radius, delta, window_width, window_height) {
    var ans = [];
    for (var x = -radius; x <= radius; x++) {
        if (x % delta != 0) continue;
        for (var y = -radius; y <= radius; y++) {
            if (y % delta != 0) continue;
            const vec = new THREE.Vector2(x, y);
            if (vec.length() <= radius) {
                // Scale so range is -1 to 1
                console.log("Adding " + x + " " + y);
                ans.push(new THREE.Vector2(2 * x / window_width, 2 * y / window_height));
            }
        }
    }
    console.log("Len pointer offsets " + ans.length);
    for (var vec_idx = 0; vec_idx < ans.length; vec_idx++) {
        console.log(ans[vec_idx]);
    }
    return ans;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
// const offsets = generatePointerOffsets(3, 1, window.innerWidth, window.innerHeight);

window.addEventListener('pointermove', onPointerMove);
function onPointerMove(event) {

    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components

    var rect = event.target.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / window.innerWidth) * 2 - 1;
    pointer.y = - ((event.clientY - rect.top) / window.innerHeight) * 2 + 1;


}

viewer.addEventListener('mousedown', () => documentMouseDown());
viewer.addEventListener('mousemove', (e) => documentMouseMove(e));
viewer.addEventListener('mouseup', () => documentMouseUp());
document.body.addEventListener('keydown', (e) => documentKeyDown(e));
function documentMouseDown() {
    mouseDown = true;
}
function documentMouseMove(e) {
    if (mouseDown && eraseMode) {
        window.requestAnimationFrame(render);
    }
}
function documentMouseUp() {
    mouseDown = false;
}
function documentKeyDown(e) {
    if (e.key === 'e' || e.key === 'E') {
        eraseMode = !eraseMode;
        controls.enabled = !eraseMode
        toggleEraseMessage();
    }
}

function toggleEraseMessage() {
    if (eraseMessage.style.display == 'none') {
        eraseMessage.style.display = 'block';
    } else {
        eraseMessage.style.display = 'none';
    }
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();


function render() {
    // Set the pixel we're casting from
    raycaster.setFromCamera(pointer, camera);

    // Calculate intersections
    const intersects = raycaster.intersectObjects(scene.children);
    for (let i = 0; i < intersects.length; i++) {
        let faceIndexToRemove = intersects[i].faceIndex;
        let vertices = [intersects[i].face.a, intersects[i].face.b, intersects[i].face.c];

        // Find each face that shares at least one vertex with the face to remove
        for (let faceIdx = 0; faceIdx < meshObj.geometry.index.array.length / 3; faceIdx++) {
            let faceVertex1 = meshObj.geometry.index.array[faceIdx * 3];
            let faceVertex2 = meshObj.geometry.index.array[faceIdx * 3 + 1];
            let faceVertex3 = meshObj.geometry.index.array[faceIdx * 3 + 2];

            if (vertices.includes(faceVertex1) || vertices.includes(faceVertex2) || vertices.includes(faceVertex3)) {
                // "Remove" the face (set all points of the face to vertex 0)
                for (let component = 0; component < 3; component++) {
                    meshObj.geometry.index.array[faceIdx * 3 + component] = 0;
                }
            }
        }
    }
    meshObj.geometry.index.needsUpdate = true;

    renderer.render(scene, camera);

}

