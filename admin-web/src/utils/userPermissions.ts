import { db, auth } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export interface UserInfo {
  uid: string;
  email: string;
  role: string;
  blockId?: string;
  blockName?: string;
  regionId?: string;
  baseId?: string;
}

export async function getUserInfo(uid: string): Promise<UserInfo | null> {
  try {
    // 現在ログイン中のユーザーのemailを取得
    const currentUserEmail = auth.currentUser?.email;
    
    if (!currentUserEmail) {
      console.warn('ログイン中のユーザーのemailが取得できません');
      return {
        uid,
        email: uid,
        role: 'admin'
      };
    }
    
    console.log('ログイン中のemail:', currentUserEmail);
    
    // emailでFirestoreのusersコレクションを検索
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', currentUserEmail));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      console.log('ユーザー情報取得成功:', userData);
      return {
        uid,
        email: userData.email,
        role: userData.role || 'user',
        blockId: userData.blockId,
        blockName: userData.blockName,
        regionId: userData.regionId,
        baseId: userData.baseId
      };
    }
    
    console.warn('Firestoreにユーザー情報が見つかりません。デフォルトで管理者として扱います:', currentUserEmail);
    return {
      uid,
      email: currentUserEmail,
      role: 'admin'
    };
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    return {
      uid,
      email: uid,
      role: 'admin'
    };
  }
}

export function buildTransactionQuery(userInfo: UserInfo) {
  const { role, blockId, regionId, baseId, uid } = userInfo;
  
  console.log('クエリ構築:', { role, blockId, regionId, baseId, uid });
  
  // 管理者：全データ
  if (role === 'admin') {
    return { field: null, value: null };
  }
  
  // ブロック責任者：自分のブロック内の全データ
  if (role === 'block_manager' && blockId) {
    return { field: 'blockId', value: blockId };
  }
  
  // 地域責任者：自分の地域内の全データ
  if (role === 'region_manager' && regionId) {
    return { field: 'regionId', value: regionId };
  }
  
  // 経営管理・管理責任者：自分の地域内の全データ
  if (role === 'base_manager' && regionId) {
    return { field: 'regionId', value: regionId };
  }
  
  // 一般ユーザー：自分の取引のみ
  return { field: 'userId', value: uid };
}
