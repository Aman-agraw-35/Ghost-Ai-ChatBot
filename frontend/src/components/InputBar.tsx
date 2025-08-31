import { useState, useRef, useEffect } from "react";
import { Smile, Send } from "lucide-react";
import EmojiPicker from "emoji-picker-react";

const InputBar = ({ currentMessage, setCurrentMessage, onSubmit }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiRef = useRef(null);

  const handleChange = (e) => {
    setCurrentMessage(e.target.value);
  };

  const handleEmojiClick = (emojiData) => {
    setCurrentMessage((prev) => prev + emojiData.emoji);
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  return (
    <form onSubmit={onSubmit} className="p-4 bg-white relative">
      <div className="flex items-center bg-[#F9F9F5] rounded-full p-3 shadow-md border border-gray-200">
        {/* Emoji Button */}
        <button
          type="button"
          title="Emoji"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200"
        >
          <Smile className="w-6 h-6" />
        </button>

        {/* Input */}
        <input
          type="text"
          placeholder="Type a message..."
          value={currentMessage}
          onChange={handleChange}
          className="flex-grow px-4 py-2 bg-transparent focus:outline-none text-gray-700"
        />

        {/* Send Button */}
        <button
          type="submit"
          title="Send"
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-full p-3 ml-2 shadow-md transition-all duration-200 group"
        >
          <Send className="w-6 h-6 text-white transform rotate-45 group-hover:scale-110 transition-transform duration-200" />
        </button>
      </div>

      {/* Emoji Picker Dropdown */}
      {showEmojiPicker && (
        <div
          ref={emojiRef}
          className="absolute bottom-20 left-4 mb-8 z-50 shadow-lg"
        >
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
