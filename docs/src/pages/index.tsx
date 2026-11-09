import React from 'react';
import { Redirect } from '@docusaurus/router';

export default function Home(): JSX.Element {
  // サイトのトップ（/）にアクセスされたら、自動的にチュートリアルへリダイレクト
  return <Redirect to="/docusaurus-for-docs/docs/tutorial/intro" />;
}