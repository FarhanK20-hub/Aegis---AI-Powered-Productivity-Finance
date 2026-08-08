"use client";

import { useState, useEffect } from 'react';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchDocuments();
    // Poll every 5 seconds to get processing updates
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('http://localhost:8000/documents/');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error("Failed to fetch documents", e);
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch('http://localhost:8000/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        fetchDocuments(); // Refresh immediately
      } else {
        const error = await res.json();
        alert(`Upload failed: ${error.detail}`);
      }
    } catch (e) {
      console.error("Upload error", e);
      alert("An error occurred during upload.");
    }
    setUploading(false);
  };

  const confirmTask = async (taskId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/tasks/${taskId}/confirm`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchDocuments(); // Refresh to remove confirmed task
      }
    } catch (e) {
      console.error("Failed to confirm task", e);
    }
  };

  const dismissTask = async (taskId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/tasks/${taskId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchDocuments(); // Refresh to remove dismissed task
      }
    } catch (e) {
      console.error("Failed to dismiss task", e);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-5xl text-black">
      <h1 className="text-3xl font-bold mb-8 text-white">Document Ingestion</h1>
      
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 mb-8">
        <h2 className="text-xl font-bold mb-4">Upload a Document</h2>
        <p className="text-sm text-gray-500 mb-4">
          Upload a PDF to automatically extract tasks and deadlines.
        </p>
        <div className="flex items-center gap-4">
          <input 
            type="file" 
            accept="application/pdf"
            onChange={handleUpload}
            disabled={uploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {uploading && <span className="text-sm text-gray-500">Uploading...</span>}
        </div>
      </div>

      <div className="space-y-6">
        {loading && <p className="text-white">Loading documents...</p>}
        {!loading && documents.length === 0 && <p className="text-white">No documents uploaded yet.</p>}
        
        {documents.map((doc: { id: number; filename: string; created_at: string; status: string; proposed_tasks?: { id: number; title: string; description?: string; due_date?: string; priority?: string; estimated_duration_minutes?: number; is_proposed?: boolean }[] }) => (
          <div key={doc.id} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{doc.filename}</h3>
                <p className="text-xs text-gray-500">Uploaded {new Date(doc.created_at).toLocaleString()}</p>
              </div>
              <div>
                {doc.status === 'processing' && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                    Processing
                  </span>
                )}
                {doc.status === 'ready' && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Ready</span>
                )}
                {doc.status === 'error' && (
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">Error</span>
                )}
              </div>
            </div>

            {doc.proposed_tasks && doc.proposed_tasks.length > 0 && (
              <div className="p-4 bg-blue-50">
                <h4 className="font-semibold text-sm text-blue-900 mb-3 uppercase tracking-wider">Proposed Tasks</h4>
                <div className="space-y-3">
                  {doc.proposed_tasks.map((task: { id: number; title: string; description?: string; due_date?: string; priority?: string; estimated_duration_minutes?: number; is_proposed?: boolean }) => (
                    <div key={task.id} className="bg-white p-3 rounded shadow-sm border border-blue-100 flex justify-between items-start">
                      <div>
                        <h5 className="font-bold text-sm">{task.title}</h5>
                        {task.description && <p className="text-xs text-gray-600 mt-1">{task.description}</p>}
                        {task.due_date && (
                          <p className="text-xs text-orange-600 mt-1 font-medium">
                            Due: {new Date(task.due_date).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4 shrink-0">
                        <button 
                          onClick={() => confirmTask(task.id)}
                          className="px-3 py-1.5 bg-black text-white text-xs font-bold rounded hover:bg-gray-800"
                        >
                          Confirm
                        </button>
                        <button 
                          onClick={() => dismissTask(task.id)}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-bold rounded hover:bg-gray-300"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {doc.status === 'ready' && (!doc.proposed_tasks || doc.proposed_tasks.length === 0) && (
              <div className="p-4 text-sm text-gray-500 italic">
                No tasks extracted from this document.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
