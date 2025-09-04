import { Ghost } from "lucide-react"; // ghost icon

const Header = () => {
    return (
        <header className="relative flex items-center justify-between sm:px-8 px-1 py-5  bg-gradient-to-r from-green-400 to-[#4A3]
 shadow-lg z-10">
            {/* Subtle overlay texture */}
            <div className="absolute inset-0 bg-[url('/api/placeholder/100/100')] opacity-5 mix-blend-overlay"></div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

            {/* Logo + App name */}
            <div className="flex items-center relative space-x-2">
                <Ghost className="w-7 h-7 text-white drop-shadow-lg" />
                <span className="font-bold text-white md:text-xl  text-sm tracking-tight">
                    Ghost-AI-Chat
                </span>
            </div>

            {/* Navigation */}
            <nav className="flex items-center space-x-2">
                {["HOME", "CHAT"].map((item, idx) => (
                    <a
                        key={idx}
                        className={`text-xs px-4 py-2 font-medium rounded-lg transition-all duration-300 cursor-pointer ${
                            item === "CHAT"
                                ? "text-white bg-white/15 shadow-md"
                                : "text-white/80 hover:text-white hover:bg-white/10"
                        }`}
                    >
                        {item}
                    </a>
                ))}
            </nav>
        </header>
    );
};

export default Header;
