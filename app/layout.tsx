import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Stock Time Lab',description:'Explore intraday stock patterns with repeatable calculations, peer comparisons and transparent costs.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
