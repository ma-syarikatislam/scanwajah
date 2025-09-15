const video = document.getElementById("video");
const statusText = document.getElementById("status");
const presensiList = document.getElementById("presensi-list");

// Daftar siswa terdaftar (contoh manual, nanti bisa dari database/Google Sheet)
const siswaTerdaftar = {
  "siswa1": "Andi",
  "siswa2": "Budi"
};
let labeledDescriptors = [];
let faceMatcher;

// Load model
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('/models')
]).then(startVideo);

function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => {
      video.srcObject = stream;
      statusText.innerText = "Model siap. Tunggu deteksi wajah...";
    })
    .catch(err => console.error(err));
}

// Training wajah (contoh: ambil gambar wajah siswa, lalu simpan embedding)
async function loadLabeledImages() {
  const labels = Object.keys(siswaTerdaftar);
  return Promise.all(
    labels.map(async label => {
      const img = await faceapi.fetchImage(`/${label}.jpg`); // Foto referensi: siswa1.jpg, siswa2.jpg
      const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
      return new faceapi.LabeledFaceDescriptors(siswaTerdaftar[label], [detections.descriptor]);
    })
  );
}

// Mulai deteksi wajah saat video berjalan
video.addEventListener("playing", async () => {
  labeledDescriptors = await loadLabeledImages();
  faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);

  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));

    results.forEach((result, i) => {
      const box = resizedDetections[i].detection.box;
      const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
      drawBox.draw(canvas);

      // Jika cocok dengan siswa terdaftar → presensi
      if (result.label !== "unknown") {
        if (!document.getElementById(result.label)) {
          const li = document.createElement("li");
          li.id = result.label;
          li.textContent = `${result.label} ✅ Hadir`;
          presensiList.appendChild(li);
        }
      }
    });
  }, 1000);
});
