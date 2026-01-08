const {onObjectFinalized} = require('firebase-functions/v2/storage');
const {initializeApp} = require('firebase-admin/app');
const {getStorage} = require('firebase-admin/storage');
const {getFirestore} = require('firebase-admin/firestore');
const sharp = require('sharp');

initializeApp();

// HEIC/HEIF画像を自動的にJPEGに変換（asia-northeast1リージョン指定）
exports.convertImageToJpeg = onObjectFinalized({
  region: 'asia-northeast1',
  bucket: 'expense-management-pcdepot.firebasestorage.app'
}, async (event) => {
  const object = event.data;
  const filePath = object.name;
  const contentType = object.contentType;
  
  // receiptsフォルダ以外は処理しない
  if (!filePath.startsWith('receipts/')) {
    console.log('Not a receipt, skipping:', filePath);
    return null;
  }
  
  // すでにJPEGの場合は処理しない
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
    console.log('Already JPEG, skipping conversion:', filePath);
    return null;
  }
  
  // 変換済みファイルは処理しない
  if (filePath.includes('_converted.jpg')) {
    console.log('Already converted, skipping:', filePath);
    return null;
  }
  
  // HEIC/HEIF/PNG/WebPなどをJPEGに変換
  const supportedTypes = ['image/heic', 'image/heif', 'image/png', 'image/webp'];
  if (!supportedTypes.includes(contentType)) {
    console.log('Unsupported type, skipping:', contentType);
    return null;
  }
  
  console.log('Converting image to JPEG:', filePath);
  
  const bucket = getStorage().bucket();
  const file = bucket.file(filePath);
  
  try {
    // 元ファイルをダウンロード
    const [imageBuffer] = await file.download();
    
    // SharpでJPEGに変換
    const convertedBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 90 })
      .toBuffer();
    
    // 変換後のファイル名を生成
    const newFilePath = filePath.replace(/\.[^.]+$/, '_converted.jpg');
    const newFile = bucket.file(newFilePath);
    
    // 変換後のファイルをアップロード
    await newFile.save(convertedBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          originalFile: filePath,
          convertedAt: new Date().toISOString()
        }
      }
    });
    
    console.log('Successfully converted to JPEG:', newFilePath);
    
    // 元のHEICファイルを削除
    await file.delete();
    console.log('Deleted original file:', filePath);
    
    // Firestoreのreceipts情報を更新
    const db = getFirestore();
    const receiptsSnapshot = await db.collection('receipts')
      .where('storagePath', '==', filePath)
      .get();
    
    if (!receiptsSnapshot.empty) {
      const receiptDoc = receiptsSnapshot.docs[0];
      const [downloadURL] = await newFile.getSignedUrl({
        action: 'read',
        expires: '03-01-2500'
      });
      
      await receiptDoc.ref.update({
        storagePath: newFilePath,
        downloadURL: downloadURL,
        fileType: 'image/jpeg',
        fileName: receiptDoc.data().fileName.replace(/\.[^.]+$/, '_converted.jpg')
      });
      
      console.log('Updated Firestore receipt document');
    }
    
    return null;
  } catch (error) {
    console.error('Error converting image:', error);
    return null;
  }
});
