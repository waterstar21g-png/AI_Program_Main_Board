'use client';

import { useState } from 'react';
import { APP_NAME } from '@/lib/app-name';
import { APP_VERSION } from '@/lib/app-version';
import { DEFAULT_PROGRAM_ID, PROGRAMS } from '@/lib/programs/registry';

export function ProgramBoardApp() {
  const [activeId, setActiveId] = useState(DEFAULT_PROGRAM_ID);
  const active = PROGRAMS.find(p => p.id === activeId) ?? PROGRAMS[0];
  const ActiveComponent = active.component;

  return (
    <div className="program-board">
      <header className="program-board__header">
        <h1 className="program-board__title">{APP_NAME}</h1>
      </header>

      <div className="program-board__body">
        <aside className="program-board__sidebar">
          <div className="program-board__sidebar-title">
            프로그램 목록 <span className="program-board__version">v{APP_VERSION}</span>
          </div>
          <ul className="program-board__list" role="listbox" aria-label="프로그램 목록">
            {PROGRAMS.map(program => (
              <li key={program.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={program.id === activeId}
                  className={`program-board__item${program.id === activeId ? ' is-active' : ''}`}
                  onClick={() => setActiveId(program.id)}
                >
                  <span className="program-board__item-name">{program.name}</span>
                  <span className="program-board__item-desc">{program.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="program-board__main">
          <div className="program-board__main-inner">
            <p className="program-unit__summary">
              <strong>{active.name}</strong> — {active.summaryLine}
            </p>
            <ActiveComponent />
          </div>
        </main>
      </div>
    </div>
  );
}
