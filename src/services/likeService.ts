import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  orderBy
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";

export interface UserLike {
  id: string;
  targetId: string;
  type: "song" | "playlist";
  createdAt: any;
}

export const toggleLike = async (targetId: string, type: "song" | "playlist", isLiked: boolean) => {
  if (!auth.currentUser) return;

  const likeId = `${type}_${targetId}`;
  const likeRef = doc(db, "users", auth.currentUser.uid, "likes", likeId);

  if (isLiked) {
    await deleteDoc(likeRef);
  } else {
    await setDoc(likeRef, {
      targetId,
      type,
      createdAt: serverTimestamp()
    });
  }
};

export const getUserLikes = async (type?: "song" | "playlist") => {
  if (!auth.currentUser) return [];

  const likesRef = collection(db, "users", auth.currentUser.uid, "likes");
  let q = query(likesRef, orderBy("createdAt", "desc"));
  
  if (type) {
    q = query(likesRef, where("type", "==", type), orderBy("createdAt", "desc"));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserLike));
};
