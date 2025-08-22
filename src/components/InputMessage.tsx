import { useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Send } from "lucide-react";

interface InputMessageProps {
    disabled: boolean;
    sendMessage: (message: string) => void;
}

export function InputMessage(props: InputMessageProps) {
    const [input, setInput] = useState("");


    function handleClick() {
        setInput("");
        props.sendMessage(input);
    }

    return (
        <div className="p-4 bg-[#36393f]">
            <div className="flex space-x-2">
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Message this room..."
                    className="flex-1 bg-[#40444b] border-[#40444b] text-[#dcddde] placeholder-[#72767d] focus:border-[#5865f2]"
                    onKeyDown={(e) => e.key === 'Enter' && handleClick()}
                />
                <Button
                    disabled={props.disabled}
                    onClick={handleClick}
                    size="sm"
                    className="bg-[#5865f2] hover:bg-[#4752c4] text-white"
                >
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}