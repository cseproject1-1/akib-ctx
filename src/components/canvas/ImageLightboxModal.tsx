import { X } from 'lucide-react';

interface ImageLightboxModalProps {
  url: string;
  alt?: string;
  onClose: () => void;
}

export function ImageLightboxModal({ url, alt, onClose }: ImageLightboxModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={url}
        alt={alt || 'Image'}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
