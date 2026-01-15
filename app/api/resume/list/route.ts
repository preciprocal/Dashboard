// app/api/resume/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';

interface ResumeDocument {
  fileName?: string;
  uploadDate?: string | Date | FirebaseFirestore.Timestamp;
  createdAt?: string | Date | FirebaseFirestore.Timestamp;
  [key: string]: unknown;
}

interface ResumeListItem {
  id: string;
  fileName: string;
  uploadDate: string;
}

// Verify Firebase Auth token
async function verifyToken(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resumesRef = db.collection('resumes');
    const snapshot = await resumesRef
      .where('userId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .get();

    const resumes: ResumeListItem[] = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>) => {
      const data = doc.data() as ResumeDocument;
      
      // Handle date conversion
      let uploadDate = new Date().toISOString();
      const dateField = data.uploadDate || data.createdAt;
      
      if (dateField) {
        try {
          if (typeof dateField === 'string') {
            uploadDate = dateField;
          } else if (dateField instanceof Date) {
            uploadDate = dateField.toISOString();
          } else if (dateField && typeof dateField === 'object' && 'toDate' in dateField) {
            // Firestore Timestamp
            uploadDate = (dateField as FirebaseFirestore.Timestamp).toDate().toISOString();
          }
        } catch (error) {
          console.error('Error parsing date:', error);
        }
      }

      return {
        id: doc.id,
        fileName: data.fileName || 'Unnamed Resume',
        uploadDate,
      };
    });

    return NextResponse.json({ resumes });

  } catch (error) {
    console.error('Error fetching resumes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resumes' },
      { status: 500 }
    );
  }
}