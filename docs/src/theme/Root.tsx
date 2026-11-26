/**
 * サイト全体に簡易パスワード認証をかける。
 *
 * Docusaurus は全ページをこの Root コンポーネントで包むため、
 * ここで認証が済むまで子要素（ページ本体）を描画しない。
 *
 * 注意：JavaScript による簡易的な目隠しであり、本格的なアクセス制限ではない。
 * サイトの JS ファイルを直接開けば本文は読める。
 */
import {useEffect, useState, type FormEvent, type ReactNode} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './Root.module.css';

// docusaurus.config.ts の PASSWORD_SALT と同じ値にすること
const PASSWORD_SALT = 'docusaurus-for-docs:';
const STORAGE_KEY = 'site-password-hash';

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readStoredHash(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeHash(hash: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, hash);
  } catch {
    // 保存できない環境（プライベートブラウズなど）では、毎回入力してもらう
  }
}

type Status = 'checking' | 'locked' | 'unlocked';

export default function Root({children}: {children: ReactNode}): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  const expectedHash = siteConfig.customFields?.passwordHash as string | undefined;

  // パスワード未設定でビルドした場合（ローカル開発など）は認証しない
  if (!expectedHash) {
    return <>{children}</>;
  }

  return <PasswordGate expectedHash={expectedHash}>{children}</PasswordGate>;
}

function PasswordGate({
  expectedHash,
  children,
}: {
  expectedHash: string;
  children: ReactNode;
}): ReactNode {
  // サーバー側の事前描画とブラウザでの初回描画は 'checking'（何も出さない）にそろえ、
  // 静的 HTML に本文が含まれないようにする
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // パスワードを変えると保存済みのハッシュと一致しなくなり、再入力を求める
    setStatus(readStoredHash() === expectedHash ? 'unlocked' : 'locked');
  }, [expectedHash]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const hash = await sha256Hex(PASSWORD_SALT + password);
      if (hash === expectedHash) {
        storeHash(hash);
        setStatus('unlocked');
      } else {
        setError('パスワードが違います。');
        setPassword('');
      }
    } catch {
      setError('このブラウザではパスワードを確認できません。');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'unlocked') {
    return <>{children}</>;
  }

  if (status === 'checking') {
    return null;
  }

  return (
    <main className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>パスワードを入力してください</h1>
        <p className={styles.description}>
          このサイトを閲覧するにはパスワードが必要です。
        </p>
        <label htmlFor="site-password" className={styles.label}>
          パスワード
        </label>
        <input
          id="site-password"
          type="password"
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="button button--primary button--block"
          disabled={submitting || password === ''}>
          表示する
        </button>
      </form>
    </main>
  );
}
