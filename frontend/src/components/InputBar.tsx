import { useState, useRef, useEffect } from "react";
import { Smile, Send, Link } from "lucide-react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface Props {
  currentMessage: string;
  setCurrentMessage: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: (e: React.FormEvent) => void;
}

const InputBar: React.FC<Props> = ({ currentMessage, setCurrentMessage, onSubmit }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const emojiRef = useRef<HTMLDivElement | null>(null);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setCurrentMessage(e.target.value);
  };

  const handleEmojiClick = (emojiData: EmojiClickData, _event?: MouseEvent) => {
    setCurrentMessage((prev) => prev + emojiData.emoji);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  return (
    <form onSubmit={onSubmit} className="sm:p-4 px-3 py-4 bg-white relative">
      <div className="flex items-center bg-[#F9F9F5] rounded-full p-3 shadow-md border border-gray-200">
        <button
          type="button"
          title="Emoji"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200"
        >
          <Smile className="w-6 h-6" />
        </button>

        <input
          type="text"
          placeholder="Type a message here..."
          value={currentMessage}
          onChange={handleChange}
          className="flex-grow sm:px-4 px-1 py-2 bg-transparent focus:outline-none text-gray-700"
        />

        <button
          type="button"
          title="Link"
          onClick={() => {
            alert("Link feature coming soon!");
          }}
          className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200"
        >
          <Link className="w-6 h-6" />
        </button>

        <button
          type="submit"
          title="Send"
          className="bg-gradient-to-r sm:mr-0 mr-4 from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-full p-3 ml-2 shadow-md transition-all duration-200 group"
        >
          <Send className="w-6 h-6 text-white transform rotate-45 group-hover:scale-110 transition-transform duration-200" />
        </button>
      </div>

      {showEmojiPicker && (
        <div ref={emojiRef} className="absolute bottom-20 left-4 mb-8 z-50 shadow-lg">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={350}
            height={300}
            searchDisabled
            skinTonesDisabled
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </form>
  );
};

export default InputBar;
