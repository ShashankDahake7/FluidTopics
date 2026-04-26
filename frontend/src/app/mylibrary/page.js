import { redirect } from 'next/navigation';

export default function MyLibraryIndex() {
  redirect('/mylibrary/bookmarks');
}
