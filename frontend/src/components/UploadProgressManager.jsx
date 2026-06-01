import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import useStore from '../store/useStore';

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function UploadProgressManager() {
  const uploadQueue = useStore((state) => state.uploadQueue);
  const removeUploadTask = useStore((state) => state.removeUploadTask);

  const handleCancelOrDismiss = (task) => {
    if (task.status === 'reading' || task.status === 'processing') {
      if (task.abortController) {
        task.abortController.abort();
      }
    } else {
      // For completed/failed tasks, just dismiss
      removeUploadTask(task.id);
    }
  };

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-3 w-80 pointer-events-none">
      <AnimatePresence>
        {uploadQueue.map((task) => {
          const isCompleted = task.status === 'completed';
          const isFailed = task.status === 'failed';
          const isProcessing = task.status === 'processing';
          const isReading = task.status === 'reading';

          let progressPercent = 0;
          if (task.totalBytes > 0) {
            progressPercent = Math.round((task.loadedBytes / task.totalBytes) * 100);
          }
          if (isProcessing) progressPercent = 100;

          // Determine styling based on status
          let borderColor = 'border-blue-500/50';
          let bgColor = 'bg-slate-900/90';
          let icon = <Loader2 size={16} className="text-blue-400 animate-spin" />;
          let statusText = 'Reading...';
          let barColor = 'bg-blue-500';

          if (isProcessing) {
            borderColor = 'border-amber-500/50';
            icon = <Loader2 size={16} className="text-amber-400 animate-spin" />;
            statusText = 'Processing...';
            barColor = 'bg-amber-500';
          } else if (isCompleted) {
            borderColor = 'border-emerald-500/50';
            icon = <CheckCircle2 size={16} className="text-emerald-400" />;
            statusText = 'Completed';
            barColor = 'bg-emerald-500';
          } else if (isFailed) {
            borderColor = 'border-rose-500/50';
            icon = <AlertCircle size={16} className="text-rose-400" />;
            statusText = 'Failed';
            barColor = 'bg-rose-500';
          }

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className={`p-3 rounded-lg border shadow-lg pointer-events-auto backdrop-blur-md transition-colors duration-300 ${bgColor} ${borderColor}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  {icon}
                  <div className="flex flex-col truncate">
                    <span className="text-sm font-semibold text-slate-200 truncate" title={task.fileName}>
                      {task.fileName}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {statusText}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelOrDismiss(task)}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                  title={isReading || isProcessing ? "Cancel" : "Dismiss"}
                >
                  <X size={14} />
                </button>
              </div>

              {!isFailed && (
                <>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1 relative">
                    <motion.div
                      className={`h-full ${barColor}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ ease: "linear", duration: 0.2 }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                    <span>
                      {formatBytes(task.loadedBytes)} / {formatBytes(task.totalBytes)}
                    </span>
                    <span className={isCompleted ? 'text-emerald-400' : 'text-blue-400'}>
                      {progressPercent}%
                    </span>
                  </div>
                </>
              )}

              {isFailed && task.error && (
                <div className="text-xs text-rose-400 mt-1 line-clamp-2">
                  {task.error}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
