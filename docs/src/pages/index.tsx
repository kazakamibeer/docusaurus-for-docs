import type {ReactNode} from 'react';
import { Redirect } from '@docusaurus/router';

export default function Home(): ReactNode {
  // サイトのトップ（/）にアクセスされたら、自動的にチュートリアルへリダイレクト
  return <Redirect to="/docusaurus-for-docs/docs/tutorial/intro" />;
}