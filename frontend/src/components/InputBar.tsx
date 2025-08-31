import { Smile, Link, Send } from "lucide-react";

const InputBar = ({ currentMessage, setCurrentMessage, onSubmit }) => {
    const handleChange = (e) => {
        setCurrentMessage(e.target.value);
    };

    return (
        <form onSubmit={onSubmit} className="p-4 bg-white">
            <div className="flex items-center bg-[#F9F9F5] rounded-full p-3 shadow-md border border-gray-200">
                {/* Emoji Button */}
                <button
                    type="button"
                    title="Emoji"
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

                {/* Attach Button */}
                <button
                    type="button"
                    title="Attach"
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all duration-200"
                >
                    <Link className="w-6 h-6" />
                </button>

                {/* Send Button */}
                <button
                    type="submit"
                    title="Send"
                    className="bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-600 hover:to-teal-500 rounded-full p-3 ml-2 shadow-md transition-all duration-200 group"
                >
                    <Send className="w-6 h-6 text-white transform rotate-45 group-hover:scale-110 transition-transform duration-200" />
                </button>
            </div>
        </form>
    );
};

export default InputBar;
