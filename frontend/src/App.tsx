import React, { useState, useCallback, useEffect } from "react";
import axios from "axios";
import "./App.css";

interface PlateResult {
  plate_text: string;
  confidence: number;
  avg_confidence: number;
  frame: number;
  timestamp: number;
  bounding_box: number[];
  occurrence_count: number;
  detection_confidence: number;
}

interface ProcessingResults {
  plates_detected: PlateResult[];
  total_frames: number;
  processed_frames: number;
  video_duration: number;
  processing_timestamp: string;
  confidence_summary: {
    total_plates: number;
    avg_confidence: number;
    max_confidence: number;
    min_confidence: number;
    high_confidence_count: number;
  };
  task_metadata: {
    task_id: string;
    processing_time_seconds: number;
    file_size_bytes: number;
    processed_at: string;
  };
}

interface TaskStatus {
  task_id: string;
  status: string;
  created_at: string;
  last_updated?: string;
  filename: string;
  file_size_mb?: number;
  result_available?: boolean;
  message?: string;
  error?: string;
  summary?: {
    plates_detected: number;
    confidence_summary: any;
  };
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessingResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState<string>("");
  const [allTasks, setAllTasks] = useState<TaskStatus[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];

      // Validate file type
      const validTypes = [
        "video/mp4",
        "video/avi",
        "video/mov",
        "video/wmv",
        "video/flv",
        "video/webm",
        "video/mkv",
      ];
      if (!validTypes.includes(selectedFile.type)) {
        setError(
          "Please select a valid video file (MP4, AVI, MOV, WMV, FLV, WebM, MKV)"
        );
        return;
      }

      // Validate file size (100MB limit)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (selectedFile.size > maxSize) {
        setError("File size must be less than 100MB");
        return;
      }

      setFile(selectedFile);
      setError(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Please select a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setError(null);
      setIsUploading(true);
      setUploadProgress(0);

      const response = await axios.post("/api/v1/process-video", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(progress);
          }
        },
      });

      setTaskId(response.data.task_id);
      setProcessingMessage(response.data.message || "Processing started...");
      pollStatus(response.data.task_id);
    } catch (error: any) {
      console.error("Upload error:", error);
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError("Error uploading file. Please try again.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const pollStatus = useCallback((id: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/v1/status/${id}`);
        const statusData: TaskStatus = response.data;

        setStatus(statusData.status);
        setProcessingMessage(statusData.message || "");

        if (statusData.status === "SUCCESS") {
          clearInterval(interval);
          // Fetch detailed results
          try {
            const resultsResponse = await axios.get(`/api/v1/results/${id}`);
            setResults(resultsResponse.data.results);
          } catch (resultsError) {
            console.error("Error fetching results:", resultsError);
            setError("Processing completed but could not fetch results.");
          }
        } else if (statusData.status === "FAILURE") {
          clearInterval(interval);
          setError(statusData.error || "Processing failed.");
        }
      } catch (error) {
        clearInterval(interval);
        setError("Error checking status.");
        console.error("Status check error:", error);
      }
    }, 2000);

    // Auto-cleanup interval after 10 minutes
    setTimeout(() => {
      clearInterval(interval);
    }, 600000);
  }, []);

  const loadTaskHistory = async () => {
    try {
      const response = await axios.get("/api/v1/tasks");
      setAllTasks(response.data.tasks || []);
    } catch (error) {
      console.error("Error loading task history:", error);
    }
  };

  const handleReset = () => {
    setFile(null);
    setTaskId(null);
    setStatus(null);
    setResults(null);
    setError(null);
    setIsUploading(false);
    setUploadProgress(0);
    setProcessingMessage("");

    // Reset file input
    const fileInput = document.getElementById("fileInput") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const deleteTask = async (taskIdToDelete: string) => {
    try {
      await axios.delete(`/api/v1/tasks/${taskIdToDelete}`);
      loadTaskHistory(); // Refresh the list

      // Clear current task if it's the one being deleted
      if (taskId === taskIdToDelete) {
        handleReset();
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  useEffect(() => {
    if (showHistory) {
      loadTaskHistory();
    }
  }, [showHistory]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return "status-success";
      case "FAILURE":
        return "status-failure";
      case "PENDING":
        return "status-pending";
      case "PROGRESS":
        return "status-progress";
      default:
        return "status-unknown";
    }
  };

  const renderConfidenceBar = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    const barClass =
      percentage >= 80
        ? "confidence-high"
        : percentage >= 60
        ? "confidence-medium"
        : "confidence-low";

    return (
      <div className="confidence-container">
        <div
          className={`confidence-bar ${barClass}`}
          style={{ width: `${percentage}%` }}
        >
          <span className="confidence-text">{percentage}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>🚗 ANPR Toll Collection System</h1>
          <p className="subtitle">
            Automatic Number Plate Recognition for Smart Toll Management
          </p>
        </div>

        <div className="main-container">
          <div className="upload-section card">
            <h2>📹 Upload Video for Processing</h2>

            <div className="file-input-container">
              <input
                id="fileInput"
                type="file"
                onChange={handleFileChange}
                accept="video/*"
                disabled={isUploading || !!taskId}
                className="file-input"
              />
              <label htmlFor="fileInput" className="file-label">
                {file
                  ? `📁 ${file.name} (${formatFileSize(file.size)})`
                  : "📁 Choose Video File"}
              </label>
            </div>

            {file && (
              <div className="file-info">
                <p>
                  <strong>File:</strong> {file.name}
                </p>
                <p>
                  <strong>Size:</strong> {formatFileSize(file.size)}
                </p>
                <p>
                  <strong>Type:</strong> {file.type}
                </p>
              </div>
            )}

            <div className="button-group">
              <button
                onClick={handleSubmit}
                disabled={!file || isUploading || !!taskId}
                className="btn btn-primary"
              >
                {isUploading
                  ? "⏳ Uploading..."
                  : taskId
                  ? "🔄 Processing..."
                  : "🚀 Upload and Process"}
              </button>

              <button
                onClick={handleReset}
                disabled={isUploading}
                className="btn btn-secondary"
              >
                🔄 Reset
              </button>

              <button
                onClick={() => setShowHistory(!showHistory)}
                className="btn btn-info"
              >
                📋 {showHistory ? "Hide" : "Show"} History
              </button>
            </div>

            {isUploading && (
              <div className="progress-section">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p>Uploading: {uploadProgress}%</p>
              </div>
            )}
          </div>

          {error && (
            <div className="error-section card">
              <h3>❌ Error</h3>
              <p>{error}</p>
            </div>
          )}

          {taskId && (
            <div className="status-section card">
              <h3>📊 Processing Status</h3>
              <div className="status-info">
                <p>
                  <strong>Task ID:</strong> <code>{taskId}</code>
                </p>
                <p>
                  <strong>Status:</strong>
                  <span
                    className={`status-badge ${getStatusBadgeClass(
                      status || ""
                    )}`}
                  >
                    {status}
                  </span>
                </p>
                {processingMessage && (
                  <p>
                    <strong>Message:</strong> {processingMessage}
                  </p>
                )}
              </div>
            </div>
          )}

          {results && (
            <div className="results-section card">
              <h2>🎯 Detection Results</h2>

              <div className="results-summary">
                <div className="summary-grid">
                  <div className="summary-card">
                    <h4>📊 Summary</h4>
                    <p>
                      <strong>Plates Detected:</strong>{" "}
                      {results.plates_detected.length}
                    </p>
                    <p>
                      <strong>Video Duration:</strong>{" "}
                      {results.video_duration.toFixed(2)}s
                    </p>
                    <p>
                      <strong>Processing Time:</strong>{" "}
                      {results.task_metadata.processing_time_seconds.toFixed(2)}
                      s
                    </p>
                    <p>
                      <strong>Frames Processed:</strong>{" "}
                      {results.processed_frames}/{results.total_frames}
                    </p>
                  </div>

                  {results.confidence_summary && (
                    <div className="summary-card">
                      <h4>🎯 Confidence Analysis</h4>
                      <p>
                        <strong>Average:</strong>{" "}
                        {(
                          results.confidence_summary.avg_confidence * 100
                        ).toFixed(1)}
                        %
                      </p>
                      <p>
                        <strong>Best:</strong>{" "}
                        {(
                          results.confidence_summary.max_confidence * 100
                        ).toFixed(1)}
                        %
                      </p>
                      <p>
                        <strong>High Confidence:</strong>{" "}
                        {results.confidence_summary.high_confidence_count}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {results.plates_detected.length > 0 ? (
                <div className="plates-table-container">
                  <h3>🚗 Detected License Plates</h3>
                  <div className="table-responsive">
                    <table className="plates-table">
                      <thead>
                        <tr>
                          <th>Plate Number</th>
                          <th>Confidence</th>
                          <th>Frame</th>
                          <th>Time (s)</th>
                          <th>Occurrences</th>
                          <th>Bounding Box</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.plates_detected.map((result, index) => (
                          <tr
                            key={index}
                            className={
                              result.avg_confidence > 0.8
                                ? "high-confidence"
                                : ""
                            }
                          >
                            <td className="plate-text">{result.plate_text}</td>
                            <td className="confidence-cell">
                              {renderConfidenceBar(result.avg_confidence)}
                            </td>
                            <td>{result.frame}</td>
                            <td>{result.timestamp.toFixed(2)}</td>
                            <td>
                              <span className="occurrence-badge">
                                {result.occurrence_count}
                              </span>
                            </td>
                            <td className="bbox-cell">
                              <small>[{result.bounding_box.join(", ")}]</small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="no-results">
                  <h3>🔍 No License Plates Detected</h3>
                  <p>
                    The system could not detect any license plates in this
                    video. This might be due to:
                  </p>
                  <ul>
                    <li>Poor video quality or lighting</li>
                    <li>License plates not clearly visible</li>
                    <li>Fast-moving vehicles</li>
                    <li>Obscured or damaged plates</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {showHistory && (
            <div className="history-section card">
              <h3>📋 Processing History</h3>
              {allTasks.length > 0 ? (
                <div className="table-responsive">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Task ID</th>
                        <th>Filename</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Size</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTasks.map((task) => (
                        <tr key={task.task_id}>
                          <td>
                            <code>{task.task_id.substring(0, 8)}...</code>
                          </td>
                          <td>{task.filename}</td>
                          <td>
                            <span
                              className={`status-badge ${getStatusBadgeClass(
                                task.status
                              )}`}
                            >
                              {task.status}
                            </span>
                          </td>
                          <td>
                            {new Date(task.created_at).toLocaleDateString()}
                          </td>
                          <td>{task.file_size_mb?.toFixed(2) || '0.00'} MB</td>
                          <td>
                            <button
                              onClick={() => deleteTask(task.task_id)}
                              className="btn btn-danger btn-small"
                            >
                              🗑️ Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No previous processing tasks found.</p>
              )}
            </div>
          )}
        </div>
      </header>
    </div>
  );
}

export default App;
