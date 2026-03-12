import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";

import {
collection,
addDoc,
onSnapshot,
query,
orderBy,
serverTimestamp
} from "firebase/firestore";

import EmojiPicker from "emoji-picker-react";

const users = ["logan","ralph","bonnie","ricky","hope","jack"];

export default function App(){

const [user,setUser] = useState(null);
const [username,setUsername] = useState("");
const [password,setPassword] = useState("");

const [msg,setMsg] = useState("");
const [messages,setMessages] = useState([]);

const [showEmoji,setShowEmoji] = useState(false);
const [panic,setPanic] = useState(false);

const bottomRef = useRef(null);

/* LOGIN */

const login = () => {
if(users.includes(username) && username === password){
setUser(username);
}else{
alert("Invalid login");
}
};

const logout = () => {
setUser(null);
};

const panicMode = () => {
setPanic(true);
};

/* LOAD MESSAGES */

useEffect(()=>{

const q = query(
collection(db,"messages"),
orderBy("time","asc")
);

const unsub = onSnapshot(q,(snapshot)=>{

setMessages(
snapshot.docs.map(doc => ({
id: doc.id,
...doc.data()
}))
);

});

return ()=>unsub();

},[]);

/* AUTO SCROLL */

useEffect(()=>{
bottomRef.current?.scrollIntoView({behavior:"smooth"});
},[messages]);

/* SEND MESSAGE */

const sendMessage = async () => {

const text = msg.trim();

if(!text) return;

try{

await addDoc(collection(db,"messages"),{
user:user,
text:text,
time:serverTimestamp()
});

setMsg("");

}catch(err){
console.error(err);
}

};

/* BOSS MODE */

if(panic){
return(
<div style={{
height:"100vh",
display:"flex",
justifyContent:"center",
alignItems:"center",
fontSize:"28px",
fontFamily:"Arial"
}}>
📊 Loading Spreadsheet...
</div>
);
}

/* LOGIN SCREEN */

if(!user){
return(

<div style={{
height:"100vh",
display:"flex",
justifyContent:"center",
alignItems:"center",
background:"#18191c"
}}>

<div style={{
background:"#2b2d31",
padding:"40px",
borderRadius:"10px",
color:"white",
width:"350px",
textAlign:"center"
}}>

<h2>Office Chat Login</h2>

<input
placeholder="username"
onChange={(e)=>setUsername(e.target.value)}
style={{width:"100%",padding:"10px",marginTop:"10px"}}
/>

<input
type="password"
placeholder="password"
onChange={(e)=>setPassword(e.target.value)}
style={{width:"100%",padding:"10px",marginTop:"10px"}}
/>

<button
onClick={login}
style={{
marginTop:"20px",
width:"100%",
padding:"10px",
background:"#5865f2",
color:"white",
border:"none",
borderRadius:"6px"
}}
>
Login
</button>

</div>
</div>
);
}

/* MAIN CHAT UI */

return(

<div style={{display:"flex",height:"100vh",fontFamily:"Segoe UI"}}>

{/* SIDEBAR */}

<div style={{
width:"220px",
background:"#1f1f23",
color:"white",
padding:"20px"
}}>

<h3>Friends</h3>

{users.map(u=>(
<div
key={u}
style={{
padding:"8px",
marginTop:"5px",
background:u===user?"#5865f2":"transparent",
borderRadius:"6px"
}}
>
{u}
</div>
))}

<button
onClick={panicMode}
style={{
marginTop:"20px",
padding:"8px",
width:"100%",
background:"#ff4444",
border:"none",
color:"white",
borderRadius:"6px"
}}
>
Boss Mode 🚨
</button>

<button
onClick={logout}
style={{
marginTop:"10px",
padding:"8px",
width:"100%",
background:"#444",
border:"none",
color:"white",
borderRadius:"6px"
}}
>
Logout
</button>

</div>

{/* CHAT SECTION */}

<div style={{flex:1,display:"flex",flexDirection:"column"}}>

{/* HEADER */}

<div style={{
background:"#5865f2",
color:"white",
padding:"15px",
fontSize:"18px"
}}>
Office Chat — {user}
</div>

{/* MESSAGES */}

<div style={{
flex:1,
overflow:"auto",
padding:"20px",
background:"#f2f3f5"
}}>

{messages.map((m)=>{

const isMe = m.user === user;

return(

<div
key={m.id}
style={{
display:"flex",
justifyContent:isMe?"flex-end":"flex-start",
marginBottom:"12px"
}}
>

<div style={{
background:isMe?"#5865f2":"white",
color:isMe?"white":"black",
padding:"10px 15px",
borderRadius:"12px",
maxWidth:"45%",
boxShadow:"0 1px 4px rgba(0,0,0,0.1)"
}}>

<b>{m.user}</b>

<br/>

{m.text}

<div style={{
fontSize:"10px",
opacity:"0.6",
marginTop:"4px"
}}>
{m.time?.toDate().toLocaleTimeString()}
</div>

</div>

</div>

);

})}

<div ref={bottomRef}></div>

</div>

{/* INPUT AREA */}

<div style={{
padding:"10px",
background:"white",
borderTop:"1px solid #ddd"
}}>

{showEmoji && (
<EmojiPicker
onEmojiClick={(emoji)=>setMsg(msg + emoji.emoji)}
/>
)}

<div style={{display:"flex"}}>

<button
onClick={()=>setShowEmoji(!showEmoji)}
style={{
marginRight:"8px",
fontSize:"18px",
padding:"8px"
}}
>
😀
</button>

<input
value={msg}
onChange={(e)=>setMsg(e.target.value)}
placeholder="Type message..."
style={{
flex:1,
padding:"12px",
fontSize:"16px",
borderRadius:"8px",
border:"1px solid #ccc"
}}
onKeyDown={(e)=>{
if(e.key === "Enter"){
e.preventDefault();
sendMessage();
}
}}
/>

<button
onClick={sendMessage}
style={{
marginLeft:"10px",
padding:"12px 25px",
background:"#5865f2",
color:"white",
border:"none",
borderRadius:"8px"
}}
>
Send
</button>

</div>

</div>

</div>

</div>

);

}