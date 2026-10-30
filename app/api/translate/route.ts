import {handleTranslation} from '@/lib/translation-server';
export async function POST(request:Request){return handleTranslation(request);}
