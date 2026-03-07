import React from 'react';
import { useNavigate } from 'react-router-dom';

const Manual: React.FC = () => {
  const navigate = useNavigate();

  const printStyle = [
    '@media print {',
    '  body { margin: 0; background: white !important; }',
    '  .no-print { display: none !important; }',
    '  .ps { background: white !important; color: black !important;',
    '        border: 1px solid #ddd !important; box-shadow: none !important;',
    '        backdrop-filter: none !important; border-radius: 0 !important; }',
    '  h2, h3 { color: black !important; -webkit-text-fill-color: black !important;',
    '           border-left-color: #7c5cbf !important; }',
    '  p, li, td, th, span { color: black !important; }',
    '  table { border-collapse: collapse !important; width: 100% !important; page-break-inside: avoid; }',
    '  th { background: #f0f0f0 !important; border: 1px solid #ccc !important; }',
    '  td { border: 1px solid #ccc !important; }',
    '  .hint-box { background: #f3e8ff !important; border-color: #7c5cbf !important; }',
    '  .warn-box { background: #fefce8 !important; border-color: #ca8a04 !important; }',
    '  .chapter { page-break-before: auto; }',
    '}',
  ].join('\n');

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const bg: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #2d2b55 100%)',
    fontFamily: "'Noto Sans JP', 'Segoe UI', sans-serif",
    color: '#e2e8f0',
    padding: '24px',
  };
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
  };
  const h2s: React.CSSProperties = {
    fontSize: '18px', fontWeight: '700', color: '#a855f7',
    borderLeft: '4px solid #a855f7', paddingLeft: '12px',
    margin: '0 0 16px',
  };
  const h3s: React.CSSProperties = {
    fontSize: '15px', fontWeight: '600', color: '#c084fc',
    margin: '18px 0 8px',
  };
  const hint: React.CSSProperties = {
    background: 'rgba(168,85,247,0.12)',
    border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: '8px', padding: '12px 16px',
    margin: '12px 0', fontSize: '14px', lineHeight: '1.7',
  };
  const warn: React.CSSProperties = {
    background: 'rgba(251,191,36,0.1)',
    border: '1px solid rgba(251,191,36,0.3)',
    borderRadius: '8px', padding: '12px 16px',
    margin: '12px 0', fontSize: '14px', lineHeight: '1.7',
  };
  const tbl: React.CSSProperties = {
    width: '100%', borderCollapse: 'collapse', fontSize: '14px', margin: '12px 0',
  };
  const th: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)', padding: '10px 14px',
    textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)',
    fontWeight: '600', color: '#c084fc',
  };
  const td: React.CSSProperties = {
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    color: '#e2e8f0',
  };

  const chapters = [
    { id: 'ch1', title: '第1章 システム概要' },
    { id: 'ch2', title: '第2章 ログイン・ログアウト' },
    { id: 'ch3', title: '第3章 ダッシュボード' },
    { id: 'ch4', title: '第4章 取引管理' },
    { id: 'ch5', title: '第5章 取引インポート' },
    { id: 'ch6', title: '第6章 未報告取引' },
    { id: 'ch7', title: '第7章 カード照合' },
    { id: 'ch8', title: '第8章 通知機能' },
    { id: 'ch9', title: '第9章 ユーザー管理' },
    { id: 'ch10', title: '第10章 カテゴリ管理' },
    { id: 'ch11', title: '第11章 招待受諾' },
    { id: 'ch12', title: '第12章 FAQ' },
  ];

  return (
    <div style={bg}>
      <style>{printStyle}</style>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

        {/* ヘッダー */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
          >&larr; ダッシュボードに戻る</button>
          <button
            onClick={() => window.print()}
            style={{ padding: '10px 28px', background: 'linear-gradient(135deg, #7c5cbf 0%, #a855f7 100%)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 16px rgba(168,85,247,0.4)' }}
          >PDF 出力 / 印刷</button>
        </div>

        {/* タイトル */}
        <div className="ps" style={card}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', background: 'linear-gradient(135deg, #7c5cbf, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 4px' }}>
            PC DEPOT Corp. 法人カード経費管理システム ユーザーマニュアル
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>v1.0 &nbsp;|&nbsp; 全12章</p>
        </div>

        {/* 本体 */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

          {/* 目次サイドバー */}
          <div className="no-print" style={{ width: '240px', flexShrink: 0, position: 'sticky', top: '24px', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
            <div style={{ ...card, marginBottom: 0, padding: '20px' }}>
              <p style={{ color: '#c084fc', fontWeight: '700', fontSize: '12px', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '1px' }}>目次</p>
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => scrollTo(ch.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#e2e8f0', cursor: 'pointer', fontSize: '13px', marginBottom: '5px', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.2)'; e.currentTarget.style.borderColor = 'rgba(168,85,247,0.4)'; e.currentTarget.style.color = '#c084fc'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e2e8f0'; }}
                >{ch.title}</button>
              ))}
            </div>
          </div>

          {/* 全章コンテンツ */}
          <div style={{ flex: 1 }}>

            <div id="ch1" className="chapter ps" style={card}>
              <h2 style={h2s}>第1章 システム概要</h2>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>PC DEPOT Corp. 法人カード経費管理システムは、役員・社員が利用する法人クレジットカードの取引を一元管理し、経費精算業務を効率化するためのWebアプリケーションです。</p>
              <h3 style={h3s}>主な機能</h3>
              <table style={tbl}><thead><tr>
                <th style={th}>機能</th><th style={th}>説明</th>
              </tr></thead><tbody>
                <tr><td style={td}>取引管理</td><td style={td}>法人カード取引の登録・編集・削除・検索</td></tr>
                <tr><td style={td}>取引インポート</td><td style={td}>CSVファイルから取引データを一括登録</td></tr>
                <tr><td style={td}>未報告取引</td><td style={td}>経費報告書未提出の取引を一覧表示・管理</td></tr>
                <tr><td style={td}>カード照合</td><td style={td}>カード明細と登録データの突合確認（管理者向け）</td></tr>
                <tr><td style={td}>通知</td><td style={td}>期限アラート・承認通知・システムメッセージ</td></tr>
                <tr><td style={td}>ユーザー管理</td><td style={td}>社員アカウントの作成・権限設定（管理者向け）</td></tr>
                <tr><td style={td}>カテゴリ管理</td><td style={td}>経費カテゴリのカスタマイズ（管理者向け）</td></tr>
                <tr><td style={td}>CSVエクスポート</td><td style={td}>取引データのCSVファイル出力・バックアップ</td></tr>
              </tbody></table>
              <h3 style={h3s}>権限一覧</h3>
              <table style={tbl}><thead><tr>
                <th style={th}>権限</th><th style={th}>利用可能機能</th>
              </tr></thead><tbody>
                <tr><td style={td}>管理者 (admin)</td><td style={td}>全機能（ユーザー管理・カード照合含む）</td></tr>
                <tr><td style={td}>一般ユーザー (user)</td><td style={td}>自分の取引管理・未報告取引・通知</td></tr>
              </tbody></table>
              <div className="hint-box" style={hint}>ヒント：初めて利用する場合は、管理者から招待メールが届きます。メール内のリンクからアカウントを設定してください。</div>
            </div>

            <div id="ch2" className="chapter ps" style={card}>
              <h2 style={h2s}>第2章 ログイン・ログアウト</h2>
              <h3 style={h3s}>ログイン手順</h3>
              <ol style={{ lineHeight: '2.0', paddingLeft: '20px', margin: '0 0 16px' }}>
                <li>ブラウザで <strong style={{ color: '#a855f7' }}>https://expense-management-pcdepot.web.app</strong> にアクセス</li>
                <li>メールアドレスとパスワードを入力</li>
                <li>「ログイン」ボタンをクリック</li>
                <li>ダッシュボードが表示されたらログイン完了</li>
              </ol>
              <div className="warn-box" style={warn}>注意：パスワードを忘れた場合は「パスワードを忘れた方はこちら」リンクからリセットメールを送信してください。</div>
              <h3 style={h3s}>ログアウト手順</h3>
              <ol style={{ lineHeight: '2.0', paddingLeft: '20px', margin: 0 }}>
                <li>ダッシュボード右上の「ログアウト」ボタンをクリック</li>
                <li>ログイン画面に戻ればログアウト完了</li>
              </ol>
            </div>

            <div id="ch3" className="chapter ps" style={card}>
              <h2 style={h2s}>第3章 ダッシュボード</h2>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>ログイン後に表示されるメイン画面です。取引状況のサマリーと各機能へのナビゲーションが配置されています。</p>
              <h3 style={h3s}>表示内容</h3>
              <table style={tbl}><thead><tr>
                <th style={th}>項目</th><th style={th}>内容</th>
              </tr></thead><tbody>
                <tr><td style={td}>今月の取引合計</td><td style={td}>当月の取引金額合計</td></tr>
                <tr><td style={td}>未報告件数</td><td style={td}>経費報告書未提出の取引件数</td></tr>
                <tr><td style={td}>今月の取引件数</td><td style={td}>当月の取引登録件数</td></tr>
                <tr><td style={td}>最近の取引</td><td style={td}>直近5件の取引一覧</td></tr>
              </tbody></table>
              <h3 style={h3s}>ナビゲーションボタン</h3>
              <table style={tbl}><thead><tr>
                <th style={th}>ボタン</th><th style={th}>機能</th>
              </tr></thead><tbody>
                <tr><td style={td}>新規取引</td><td style={td}>新しい取引を手動登録</td></tr>
                <tr><td style={td}>用途管理</td><td style={td}>カテゴリ管理画面へ移動</td></tr>
                <tr><td style={td}>未報告</td><td style={td}>未報告取引一覧へ移動</td></tr>
                <tr><td style={td}>取引一覧</td><td style={td}>全取引の一覧へ移動</td></tr>
                <tr><td style={td}>通知</td><td style={td}>通知一覧へ移動</td></tr>
                <tr><td style={td}>ユーザー管理</td><td style={td}>ユーザー管理画面へ移動（管理者のみ）</td></tr>
                <tr><td style={td}>マニュアル</td><td style={td}>このマニュアルを表示</td></tr>
                <tr><td style={td}>ログアウト</td><td style={td}>ログアウト</td></tr>
              </tbody></table>
            </div>

            <div id="ch4" className="chapter ps" style={card}>
              <h2 style={h2s}>第4章 取引管理</h2>
              <h3 style={h3s}>取引一覧の表示</h3>
              <p style={{ lineHeight: '1.8' }}>「取引一覧」ボタンから全取引を確認できます。以下のフィルター機能で絞り込みが可能です。</p>
              <table style={tbl}><thead><tr>
                <th style={th}>フィルター</th><th style={th}>説明</th>
              </tr></thead><tbody>
                <tr><td style={td}>取引月</td><td style={td}>プルダウンで月を選択（最新月が上、デフォルト：全期間）</td></tr>
                <tr><td style={td}>使用者</td><td style={td}>プルダウンで使用者を選択（50音順、デフォルト：全員）</td></tr>
                <tr><td style={td}>ステータス</td><td style={td}>全て・承認済・未処理・差戻し・申請中で絞り込み</td></tr>
                <tr><td style={td}>🔍 フリーワード検索</td><td style={td}>店舗名・メモのキーワードで絞り込み</td></tr>
              </tbody></table>
              <div className="hint-box" style={hint}>ヒント：フィルターは組み合わせて使用できます。例：「2026年3月」×「承認済」で特定月の承認済取引のみ表示。</div>
              <h3 style={h3s}>一括承認・差戻し</h3>
              <p style={{ lineHeight: '1.8' }}>取引一覧の各行にチェックボックスがあり、複数の取引をまとめて操作できます。</p>
              <table style={tbl}><thead><tr>
                <th style={th}>ボタン</th><th style={th}>動作</th>
              </tr></thead><tbody>
                <tr><td style={td}>✅ 一括承認</td><td style={td}>選択した取引を「承認済」に変更</td></tr>
                <tr><td style={td}>⚠️ 一括差戻し</td><td style={td}>選択した取引を「差戻し」に変更</td></tr>
                <tr><td style={td}>↩️ 未処理に戻す</td><td style={td}>選択した取引を「未処理」に変更</td></tr>
                <tr><td style={td}>✕ 選択解除</td><td style={td}>選択状態をすべて解除</td></tr>
              </tbody></table>
              <div className="hint-box" style={hint}>ヒント：ヘッダー行のチェックボックスをクリックすると、表示中の全取引を一括選択できます。フィルターで絞り込んでから一括承認すると効率的です。</div>
              <h3 style={h3s}>ページネーション</h3>
              <p style={{ lineHeight: '1.8' }}>取引件数が20件を超える場合、ページ分割で表示されます。画面下部の「前へ」「次へ」ボタンでページを切り替えてください。フィルター条件を変更すると自動的に1ページ目に戻ります。</p>
              <h3 style={h3s}>CSVエクスポート</h3>
              <p style={{ lineHeight: '1.8' }}>取引一覧画面右上の「CSVエクスポート」ボタンをクリックすると、現在のフィルター条件で絞り込まれたデータをCSVファイルとして出力できます。</p>
              <table style={tbl}><thead><tr>
                <th style={th}>出力項目</th>
              </tr></thead><tbody>
                <tr><td style={td}>取引日・店舗名・金額・ステータス・メモ・使用者</td></tr>
              </tbody></table>
              <div className="hint-box" style={hint}>ヒント：月次でエクスポートしてデータをバックアップすることを推奨します。エクスポート後に該当データを削除することも可能です。</div>
              <h3 style={h3s}>新規取引の登録</h3>
              <ol style={{ lineHeight: '2.0', paddingLeft: '20px', margin: '0 0 16px' }}>
                <li>「新規取引」ボタンをクリック</li>
                <li>領収書画像をアップロードすると<strong style={{ color: '#a855f7' }}>AI自動認識（OCR）</strong>で店舗名・金額・取引日が自動入力される</li>
                <li>内容を確認・修正し、カテゴリ・メモを入力</li>
                <li>「保存」をクリック</li>
              </ol>
              <div className="hint-box" style={hint}>ヒント：領収書のOCR自動認識はAIが店舗名・金額・取引日を読み取ります。認識精度は領収書の状態により異なりますので、必ず内容を確認してから保存してください。</div>
              <h3 style={h3s}>取引の編集・削除</h3>
              <p style={{ lineHeight: '1.8' }}>取引一覧から対象行をクリックして詳細画面を開き、「編集」または「削除」ボタンを操作します。</p>
              <div className="warn-box" style={warn}>注意：削除した取引は復元できません。誤操作に注意してください。</div>
              <h3 style={h3s}>取引詳細画面</h3>
              <p style={{ lineHeight: '1.8' }}>取引一覧の「👁️ 詳細」ボタンから開きます。以下の情報が確認できます。</p>
              <table style={tbl}><thead><tr>
                <th style={th}>項目</th><th style={th}>内容</th>
              </tr></thead><tbody>
                <tr><td style={td}>使用者</td><td style={td}>取引を登録したスタッフの表示名</td></tr>
                <tr><td style={td}>ステータス</td><td style={td}>現在の承認状態</td></tr>
                <tr><td style={td}>証憑画像</td><td style={td}>登録された領収書画像（クリックで拡大表示）</td></tr>
                <tr><td style={td}>ステータス変更</td><td style={td}>承認・差戻し・未処理に戻すボタン（管理者・マネージャーのみ表示）</td></tr>
              </tbody></table>
              <div className="hint-box" style={hint}>ヒント：証憑画像をクリックすると拡大表示されます。画像をクリックすると閉じます。</div>
              <h3 style={h3s}>取引編集画面</h3>
              <p style={{ lineHeight: '1.8' }}>取引一覧の「✏️ 編集」ボタンから開きます。取引日・金額・加盟店名・用途・メモの編集が可能です。</p>
              <table style={tbl}><thead><tr>
                <th style={th}>機能</th><th style={th}>内容</th>
              </tr></thead><tbody>
                <tr><td style={td}>使用者・ステータス表示</td><td style={td}>画面上部に使用者名と現在のステータスを表示</td></tr>
                <tr><td style={td}>取引情報編集</td><td style={td}>取引日・金額・加盟店名・用途・メモを編集して保存</td></tr>
                <tr><td style={td}>ステータス変更</td><td style={td}>承認・差戻し・未処理に戻すボタン（管理者・マネージャーのみ表示）</td></tr>
              </tbody></table>
              <div className="hint-box" style={hint}>ヒント：証憑画像の編集は「詳細」画面から行ってください。編集画面では取引情報のみ変更できます。</div>
            </div>

            <div id="ch5" className="chapter ps" style={card}>
              <h2 style={h2s}>第5章 取引インポート</h2>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>CSVファイルを使って複数の取引データを一括で登録できます。</p>
              <h3 style={h3s}>CSVフォーマット</h3>
              <table style={tbl}><thead><tr>
                <th style={th}>列名</th><th style={th}>形式</th><th style={th}>必須</th>
              </tr></thead><tbody>
                <tr><td style={td}>date</td><td style={td}>YYYY-MM-DD</td><td style={td}>必須</td></tr>
                <tr><td style={td}>amount</td><td style={td}>整数（円）</td><td style={td}>必須</td></tr>
                <tr><td style={td}>category</td><td style={td}>カテゴリ名</td><td style={td}>必須</td></tr>
                <tr><td style={td}>description</td><td style={td}>テキスト</td><td style={td}>任意</td></tr>
                <tr><td style={td}>merchant</td><td style={td}>テキスト</td><td style={td}>任意</td></tr>
              </tbody></table>
              <h3 style={h3s}>インポート手順</h3>
              <ol style={{ lineHeight: '2.0', paddingLeft: '20px', margin: '0 0 12px' }}>
                <li>取引一覧画面の「CSVインポート」ボタンをクリック</li>
                <li>CSVファイルを選択またはドラッグ＆ドロップ</li>
                <li>プレビューで内容を確認</li>
                <li>「インポート実行」をクリック</li>
              </ol>
              <div className="hint-box" style={hint}>ヒント：カード会社のWebサービスから明細CSVをダウンロードし、列名を上記フォーマットに変換することで手入力を大幅に削減できます。</div>
            </div>

            <div id="ch6" className="chapter ps" style={card}>
              <h2 style={h2s}>第6章 未報告取引</h2>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>経費報告書をまだ提出していない取引の一覧を管理します。</p>
              <h3 style={h3s}>未報告取引の確認</h3>
              <ol style={{ lineHeight: '2.0', paddingLeft: '20px', margin: '0 0 16px' }}>
                <li>ダッシュボードの「未報告」ボタンをクリック</li>
                <li>未報告取引の一覧が表示される</li>
                <li>各取引を確認し、経費報告書を作成</li>
              </ol>
              <h3 style={h3s}>報告済みへの変更</h3>
              <p style={{ lineHeight: '1.8' }}>取引詳細画面で「報告済みとしてマーク」ボタンをクリックすると、未報告リストから除外されます。</p>
              <div className="warn-box" style={warn}>注意：月次の経費精算締め日までに全件の報告を完了してください。</div>
            </div>

            <div id="ch7" className="chapter ps" style={card}>
              <h2 style={h2s}>第7章 カード照合</h2>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>管理者向けの機能です。カード会社から提供される明細と、システムに登録されたデータを突合します。</p>
              <h3 style={h3s}>照合手順</h3>
              <ol style={{ lineHeight: '2.0', paddingLeft: '20px', margin: '0 0 12px' }}>
                <li>ダッシュボードのナビゲーションから「カード照合」へ移動</li>
                <li>カード明細CSVをアップロード</li>
                <li>システムの登録データと自動マッチング</li>
                <li>未一致の取引を手動で確認・処理</li>
              </ol>
              <div className="hint-box" style={hint}>ヒント：照合は月次で実施することを推奨します。差異が見つかった場合は取引の修正または追加登録を行ってください。</div>
            </div>

            <div id="ch8" className="chapter ps" style={card}>
              <h2 style={h2s}>第8章 通知機能</h2>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>システムからの重要なお知らせや期限アラートを確認できます。</p>
              <h3 style={h3s}>通知の種類</h3>
              <table style={tbl}><thead><tr>
                <th style={th}>種類</th><th style={th}>内容</th>
              </tr></thead><tbody>
                <tr><td style={td}>期限アラート</td><td style={td}>経費報告締め日が近づいたときの通知</td></tr>
                <tr><td style={td}>承認通知</td><td style={td}>管理者による取引承認・却下の通知</td></tr>
                <tr><td style={td}>システム通知</td><td style={td}>メンテナンスや機能更新のお知らせ</td></tr>
              </tbody></table>
              <h3 style={h3s}>通知の確認</h3>
              <p style={{ lineHeight: '1.8' }}>ダッシュボードの「通知」ボタンをクリックして通知一覧を確認します。未読通知はバッジで件数が表示されます。</p>
            </div>

            <div id="ch9" className="chapter ps" style={card}>
              <h2 style={h2s}>第9章 ユーザー管理</h2>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>管理者向けの機能です。社員アカウントの作成・編集・権限設定を行います。</p>
              <h3 style={h3s}>新規ユーザーの招待</h3>
              <ol style={{ lineHeight: '2.0', paddingLeft: '20px', margin: '0 0 16px' }}>
                <li>「ユーザー管理」をクリック</li>
                <li>「新規招待」ボタンをクリック</li>
                <li>招待先のメールアドレスと権限を設定</li>
                <li>「招待メール送信」をクリック</li>
              </ol>
              <h3 style={h3s}>権限の変更</h3>
              <p style={{ lineHeight: '1.8' }}>ユーザー一覧から対象ユーザーを選択し、「編集」から権限（admin / user）を変更できます。</p>
              <div className="warn-box" style={warn}>注意：管理者権限は必要な担当者のみに付与し、定期的に見直してください。</div>
            </div>

            <div id="ch10" className="chapter ps" style={card}>
              <h2 style={h2s}>第10章 カテゴリ管理</h2>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>取引に割り当てる経費カテゴリをカスタマイズできます。</p>
              <h3 style={h3s}>カテゴリの追加</h3>
              <ol style={{ lineHeight: '2.0', paddingLeft: '20px', margin: '0 0 16px' }}>
                <li>「用途管理」をクリック</li>
                <li>「カテゴリ追加」ボタンをクリック</li>
                <li>カテゴリ名・色・アイコンを設定</li>
                <li>「保存」をクリック</li>
              </ol>
              <h3 style={h3s}>デフォルトカテゴリ</h3>
              <table style={tbl}><thead><tr>
                <th style={th}>カテゴリ</th><th style={th}>用途例</th>
              </tr></thead><tbody>
                <tr><td style={td}>交通費</td><td style={td}>電車・タクシー・駐車場</td></tr>
                <tr><td style={td}>飲食費</td><td style={td}>接待・社内会食</td></tr>
                <tr><td style={td}>宿泊費</td><td style={td}>出張時のホテル</td></tr>
                <tr><td style={td}>消耗品</td><td style={td}>文具・事務用品</td></tr>
                <tr><td style={td}>その他</td><td style={td}>上記に該当しない経費</td></tr>
              </tbody></table>
            </div>

            <div id="ch11" className="chapter ps" style={card}>
              <h2 style={h2s}>第11章 招待受諾</h2>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>管理者から招待メールを受け取った新規ユーザーのためのガイドです。</p>
              <h3 style={h3s}>アカウント設定手順</h3>
              <ol style={{ lineHeight: '2.0', paddingLeft: '20px', margin: '0 0 12px' }}>
                <li>招待メールを受信し、メール内の「アカウント設定」リンクをクリック</li>
                <li>パスワードを設定（8文字以上、英数字混在）</li>
                <li>「アカウントを作成」ボタンをクリック</li>
                <li>ログイン画面からメールアドレスと設定したパスワードでログイン</li>
              </ol>
              <div className="hint-box" style={hint}>ヒント：招待リンクの有効期限は24時間です。期限が切れた場合は管理者に再送を依頼してください。</div>
            </div>

            <div id="ch12" className="chapter ps" style={card}>
              <h2 style={h2s}>第12章 よくある質問（FAQ）</h2>
              <h3 style={h3s}>Q. パスワードを忘れてしまった</h3>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>ログイン画面の「パスワードを忘れた方はこちら」からパスワードリセットメールを送信できます。</p>
              <h3 style={h3s}>Q. 取引が表示されない</h3>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>検索フィルターや期間設定を確認してください。期間を「全期間」に設定するか、フィルターをリセットすると表示されることがあります。</p>
              <h3 style={h3s}>Q. CSVインポートでエラーが出る</h3>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>CSVのエンコードがUTF-8であること、列名が正しいこと、日付形式がYYYY-MM-DDであることを確認してください。</p>
              <h3 style={h3s}>Q. 管理者機能が表示されない</h3>
              <p style={{ lineHeight: '1.8', marginBottom: '16px' }}>管理者権限（admin）が付与されているか確認してください。権限の変更は他の管理者に依頼してください。</p>
              <div className="hint-box" style={hint}>その他のお問い合わせ：システム管理担当者または IT 部門までご連絡ください。</div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Manual;
