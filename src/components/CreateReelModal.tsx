import React, { useState } from 'react';
import { Film, Upload, Link as LinkIcon, CheckCircle2, Video } from 'lucide-react';
import { api } from '../services/api';
import type { Profile, Property, Reel } from '../types/database';

interface CreateReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile;
  userProperties: Property[];
  onSuccess: (newReel: Reel) => void;
}

export const CreateReelModal: React.FC<CreateReelModalProps> = ({
  isOpen,
  onClose,
  currentUser: _currentUser,
  userProperties,
  onSuccess
}) => {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [loading, setLoading] = useState(false);
  const [uploadingProgress, setUploadingProgress] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      const objectUrl = URL.createObjectURL(file);
      setVideoPreviewUrl(objectUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!title) {
      setErrorMsg('Please enter a Reel title.');
      return;
    }
    if (uploadMode === 'file' && !videoFile && !videoPreviewUrl) {
      setErrorMsg('Please select a video file to upload.');
      return;
    }

    setLoading(true);
    setUploadingProgress(true);

    try {
      let finalVideoUrl = videoPreviewUrl;

      if (uploadMode === 'file' && videoFile) {
        finalVideoUrl = await api.uploadReelMedia(videoFile);
      }

      const createdReel = await api.createReel({
        title,
        caption,
        video_url: finalVideoUrl,
        property_id: selectedPropertyId || undefined,
      });

      setTitle('');
      setCaption('');
      setVideoFile(null);
      setVideoPreviewUrl('');
      setSelectedPropertyId('');

      onSuccess(createdReel);
      onClose();
    } catch (err: any) {
      console.error('Create reel error:', err);
      setErrorMsg(err.message || 'Failed to upload Reel. Please try again.');
    } finally {
      setLoading(false);
      setUploadingProgress(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600 rounded-xl">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Upload Real-Estate Video Reel</h3>
              <p className="text-xs text-slate-300">Direct 9:16 vertical video tour upload</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-xl">
            ✕
          </button>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs leading-relaxed space-y-1">
            <div className="flex items-center justify-between font-bold text-rose-700 text-sm">
              <span>❌ Reel Upload / Database Error</span>
              <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800 font-bold">✕</button>
            </div>
            <p className="font-mono bg-white/80 p-2 rounded-lg border border-rose-100 text-rose-800 overflow-x-auto">{errorMsg}</p>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Upload Method Switcher */}
          <div className="flex border border-slate-200 p-1 bg-slate-50 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setUploadMode('file')}
              className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                uploadMode === 'file' ? 'bg-white text-purple-700 shadow-sm font-bold' : 'text-slate-600'
              }`}
            >
              <Upload className="w-3.5 h-3.5" /> Select Video File
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('url')}
              className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                uploadMode === 'url' ? 'bg-white text-purple-700 shadow-sm font-bold' : 'text-slate-600'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" /> Video URL
            </button>
          </div>

          {/* DIRECT FILE UPLOAD ZONE */}
          {uploadMode === 'file' ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Video Tour File (MP4, MOV, WebM)
              </label>
              
              <div className="relative border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50 rounded-2xl p-6 text-center transition cursor-pointer group">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                
                {videoPreviewUrl ? (
                  <div className="space-y-2">
                    <video
                      src={videoPreviewUrl}
                      controls
                      className="max-h-48 mx-auto rounded-xl shadow-md border bg-black"
                    />
                    <div className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4" /> Ready for upload ({videoFile?.name || 'Selected Video'})
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition">
                      <Video className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Click or drag & drop video file</p>
                      <p className="text-xs text-slate-500">Supports MP4, MOV, WebM (Recommended 9:16 vertical format)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Video Storage URL
              </label>
              <input
                type="url"
                required
                value={videoPreviewUrl}
                onChange={(e) => setVideoPreviewUrl(e.target.value)}
                placeholder="https://assets.mixkit.co/...video.mp4"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reel Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Worli Sea-Facing Penthouse Walkthrough 🌊✨"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Caption & Details
            </label>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Take a private walkthrough of this luxury penthouse with panoramic ocean views..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Link to Property */}
          <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-100 space-y-2">
            <label className="block text-xs font-bold text-purple-900 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-purple-600" /> Attach to Property (Reel → Property → Enquiry)
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 bg-white font-medium"
            >
              <option value="">-- Select Property to Attach --</option>
              {userProperties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} - ₹{p.price.toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-200 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {uploadingProgress ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  Uploading Video...
                </>
              ) : (
                'Publish Video Reel'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
