
import cv2
import easyocr
import os
import numpy as np
import re
import logging
from typing import List, Dict, Tuple, Optional
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ANPR:
    def __init__(self):
        """Initialize ANPR system with improved OCR and plate detection."""
        try:
            self.reader = easyocr.Reader(['en'], gpu=False)  # Set gpu=True if CUDA available
            logger.info("EasyOCR reader initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize EasyOCR: {e}")
            raise
        
        # Load multiple cascade classifiers for better detection
        self.plate_cascades = self._load_plate_cascades()
        
        # Plate validation patterns (US format examples)
        self.plate_patterns = [
            r'^[A-Z0-9]{2,3}[A-Z0-9]{2,4}$',  # General alphanumeric
            r'^[A-Z]{1,3}[0-9]{3,4}$',        # Letters followed by numbers
            r'^[0-9]{1,3}[A-Z]{2,3}[0-9]{1,4}$',  # Numbers-Letters-Numbers
        ]

    def _load_plate_cascades(self) -> List[cv2.CascadeClassifier]:
        """Load multiple cascade classifiers for better plate detection."""
        cascades = []
        cascade_files = [
            'haarcascade_russian_plate_number.xml',
            'haarcascade_frontalface_alt.xml'  # Sometimes works for rectangular objects
        ]
        
        for cascade_file in cascade_files:
            try:
                cascade_path = cv2.data.haarcascades + cascade_file
                if os.path.exists(cascade_path):
                    cascade = cv2.CascadeClassifier(cascade_path)
                    if not cascade.empty():
                        cascades.append(cascade)
                        logger.info(f"Loaded cascade: {cascade_file}")
            except Exception as e:
                logger.warning(f"Could not load cascade {cascade_file}: {e}")
        
        return cascades

    def process_video(self, video_path: str) -> Dict:
        """
        Process video file for license plate detection with improved accuracy.
        
        Args:
            video_path: Path to video file
            
        Returns:
            Dictionary containing results and metadata
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {video_path}")
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        
        results = []
        confidence_scores = []
        frame_nmr = 0
        processed_frames = 0
        
        logger.info(f"Processing video: {video_path} ({total_frames} frames, {duration:.2f}s)")
        
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                # Process every 5th frame for better coverage
                if frame_nmr % 5 == 0:
                    timestamp = frame_nmr / fps if fps > 0 else frame_nmr
                    
                    # Detect and recognize plates in this frame
                    frame_results = self._process_frame(frame, frame_nmr, timestamp)
                    results.extend(frame_results)
                    processed_frames += 1
                    
                    if processed_frames % 20 == 0:
                        logger.info(f"Processed {processed_frames} frames...")
                
                frame_nmr += 1

        except Exception as e:
            logger.error(f"Error processing video: {e}")
        finally:
            cap.release()
        
        # Clean up video file
        try:
            os.remove(video_path)
            logger.info(f"Cleaned up video file: {video_path}")
        except Exception as e:
            logger.warning(f"Could not remove video file: {e}")
        
        # Post-process results
        final_results = self._post_process_results(results)
        
        return {
            "plates_detected": final_results,
            "total_frames": total_frames,
            "processed_frames": processed_frames,
            "video_duration": duration,
            "processing_timestamp": datetime.now().isoformat(),
            "confidence_summary": self._calculate_confidence_summary(final_results)
        }

    def _process_frame(self, frame: np.ndarray, frame_nmr: int, timestamp: float) -> List[Dict]:
        """Process a single frame for plate detection."""
        frame_results = []
        
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Apply image enhancements
        enhanced_gray = self._enhance_image(gray)
        
        # Detect plates using multiple methods
        plates = self._detect_plates_multi_method(enhanced_gray)
        
        for (x, y, w, h, confidence) in plates:
            # Extract plate region with padding
            plate_img = self._extract_plate_region(enhanced_gray, x, y, w, h)
            
            if plate_img is not None:
                # Recognize text
                text_results = self._recognize_text(plate_img)
                
                for text_data in text_results:
                    if self._validate_plate_text(text_data['text']):
                        frame_results.append({
                            "plate_text": text_data['text'],
                            "confidence": text_data['confidence'],
                            "frame": frame_nmr,
                            "timestamp": timestamp,
                            "bounding_box": [int(x), int(y), int(w), int(h)],
                            "detection_confidence": confidence
                        })
        
        return frame_results

    def _enhance_image(self, gray_img: np.ndarray) -> np.ndarray:
        """Apply image enhancements for better OCR."""
        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray_img)
        
        # Apply bilateral filter to reduce noise while preserving edges
        enhanced = cv2.bilateralFilter(enhanced, 9, 75, 75)
        
        return enhanced

    def _detect_plates_multi_method(self, gray_frame: np.ndarray) -> List[Tuple]:
        """Detect plates using multiple methods and combine results."""
        all_plates = []
        
        # Method 1: Haar Cascades
        for cascade in self.plate_cascades:
            plates = cascade.detectMultiScale(
                gray_frame, 
                scaleFactor=1.1, 
                minNeighbors=3,
                minSize=(50, 20),
                maxSize=(300, 150)
            )
            for (x, y, w, h) in plates:
                all_plates.append((x, y, w, h, 0.7))  # Default confidence
        
        # Method 2: Contour-based detection
        contour_plates = self._detect_plates_by_contours(gray_frame)
        all_plates.extend(contour_plates)
        
        # Remove duplicates and return best candidates
        return self._filter_duplicate_plates(all_plates)

    def _detect_plates_by_contours(self, gray_frame: np.ndarray) -> List[Tuple]:
        """Detect license plates using contour analysis."""
        plates = []
        
        # Apply edge detection
        edges = cv2.Canny(gray_frame, 50, 150, apertureSize=3)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            # Calculate bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Filter based on aspect ratio and size (typical plate dimensions)
            aspect_ratio = w / h if h > 0 else 0
            area = w * h
            
            if (2.0 <= aspect_ratio <= 6.0 and 
                1000 <= area <= 50000 and 
                w >= 50 and h >= 20):
                plates.append((x, y, w, h, 0.6))  # Contour-based confidence
        
        return plates

    def _filter_duplicate_plates(self, plates: List[Tuple]) -> List[Tuple]:
        """Remove duplicate plate detections using non-maximum suppression."""
        if not plates:
            return []
        
        # Convert to numpy array for processing
        boxes = np.array([[x, y, x+w, y+h] for x, y, w, h, _ in plates])
        confidences = np.array([conf for _, _, _, _, conf in plates])
        
        # Apply non-maximum suppression
        indices = cv2.dnn.NMSBoxes(boxes.tolist(), confidences.tolist(), 0.5, 0.4)
        
        filtered_plates = []
        if len(indices) > 0:
            for i in indices.flatten():
                x, y, x2, y2 = boxes[i]
                w, h = x2 - x, y2 - y
                filtered_plates.append((x, y, w, h, confidences[i]))
        
        return filtered_plates

    def _extract_plate_region(self, gray_img: np.ndarray, x: int, y: int, w: int, h: int) -> Optional[np.ndarray]:
        """Extract and preprocess plate region."""
        # Add padding
        padding = 10
        x_start = max(0, x - padding)
        y_start = max(0, y - padding)
        x_end = min(gray_img.shape[1], x + w + padding)
        y_end = min(gray_img.shape[0], y + h + padding)
        
        plate_img = gray_img[y_start:y_end, x_start:x_end]
        
        if plate_img.size == 0:
            return None
        
        # Resize if too small
        if plate_img.shape[0] < 30 or plate_img.shape[1] < 60:
            scale_factor = max(30 / plate_img.shape[0], 60 / plate_img.shape[1])
            new_width = int(plate_img.shape[1] * scale_factor)
            new_height = int(plate_img.shape[0] * scale_factor)
            plate_img = cv2.resize(plate_img, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
        
        # Apply morphological operations to clean up the image
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        plate_img = cv2.morphologyEx(plate_img, cv2.MORPH_CLOSE, kernel)
        
        return plate_img

    def _recognize_text(self, plate_img: np.ndarray) -> List[Dict]:
        """Recognize text from plate image with confidence scoring."""
        text_results = []
        
        try:
            # Add border to improve OCR
            bordered_img = cv2.copyMakeBorder(
                plate_img, 10, 10, 10, 10, 
                cv2.BORDER_CONSTANT, value=[255, 255, 255]
            )
            
            # Use EasyOCR with detailed results
            results = self.reader.readtext(bordered_img, detail=1, paragraph=False)
            
            for (bbox, text, confidence) in results:
                # Clean up text
                cleaned_text = self._clean_plate_text(text)
                if cleaned_text and confidence > 0.3:  # Minimum confidence threshold
                    text_results.append({
                        'text': cleaned_text,
                        'confidence': confidence,
                        'bbox': bbox
                    })
        
        except Exception as e:
            logger.warning(f"Error in text recognition: {e}")
        
        return text_results

    def _clean_plate_text(self, text: str) -> str:
        """Clean and normalize plate text."""
        if not text:
            return ""
        
        # Remove non-alphanumeric characters and convert to uppercase
        cleaned = re.sub(r'[^A-Z0-9]', '', text.upper())
        
        # Common OCR corrections
        corrections = {
            'O': '0', 'I': '1', 'S': '5', 'B': '8', 'Z': '2', 'G': '6'
        }
        
        # Apply corrections only if it makes the plate format more valid
        for old, new in corrections.items():
            if old in cleaned:
                corrected = cleaned.replace(old, new)
                if self._validate_plate_text(corrected):
                    cleaned = corrected
                    break
        
        return cleaned

    def _validate_plate_text(self, text: str) -> bool:
        """Validate if text matches license plate patterns."""
        if not text or len(text) < 3 or len(text) > 8:
            return False
        
        # Check against plate patterns
        for pattern in self.plate_patterns:
            if re.match(pattern, text):
                return True
        
        # Additional checks: at least one letter and one number
        has_letter = bool(re.search(r'[A-Z]', text))
        has_number = bool(re.search(r'[0-9]', text))
        
        return has_letter and has_number

    def _post_process_results(self, results: List[Dict]) -> List[Dict]:
        """Post-process results to remove duplicates and rank by confidence."""
        if not results:
            return []
        
        # Group by plate text
        plate_groups = {}
        for result in results:
            plate_text = result['plate_text']
            if plate_text not in plate_groups:
                plate_groups[plate_text] = []
            plate_groups[plate_text].append(result)
        
        # Select best detection for each unique plate
        final_results = []
        for plate_text, detections in plate_groups.items():
            # Sort by confidence and select best
            best_detection = max(detections, key=lambda x: x['confidence'])
            
            # Add occurrence count
            best_detection['occurrence_count'] = len(detections)
            best_detection['avg_confidence'] = sum(d['confidence'] for d in detections) / len(detections)
            
            final_results.append(best_detection)
        
        # Sort by average confidence
        final_results.sort(key=lambda x: x['avg_confidence'], reverse=True)
        
        return final_results

    def _calculate_confidence_summary(self, results: List[Dict]) -> Dict:
        """Calculate confidence statistics."""
        if not results:
            return {"message": "No plates detected"}
        
        confidences = [r['avg_confidence'] for r in results]
        
        return {
            "total_plates": len(results),
            "avg_confidence": sum(confidences) / len(confidences),
            "max_confidence": max(confidences),
            "min_confidence": min(confidences),
            "high_confidence_count": sum(1 for c in confidences if c > 0.8)
        }