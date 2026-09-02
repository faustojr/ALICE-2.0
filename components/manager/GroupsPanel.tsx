/**
 * Turmas por secretaria.
 *
 * O gestor compra assentos para a prefeitura e distribui a equipe por área.
 * Sem isso o painel mostra um bolo único de servidores, e ele não consegue
 * responder "como está a Saúde" — que é a pergunta que ele leva à reunião.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Trash2, UserPlus, AlertTriangle } from 'lucide-react';
import {
  assignMember,
  createGroup,
  deleteGroup,
  fetchGroups,
  type GroupMember,
  type ManagerGroup,
} from '../../services/managerApi';

const GroupsPanel: React.FC = () => {
  const [groups, setGroups] = useState<ManagerGroup[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [ungrouped, setUngrouped] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchGroups(refresh);
      setGroups(data.groups);
      setMembers(data.members);
      setUngrouped(data.ungrouped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as turmas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    setError('');
    try {
      await createGroup(name);
      setNewName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar a turma.');
    } finally {
      setCreating(false);
    }
  };

  const move = async (member: GroupMember, groupId: string | null) => {
    const previous = members;
    setMembers((list) =>
      list.map((m) => (m.id === member.id ? { ...m, groupId } : m))
    );
    try {
      await assignMember(member.id, groupId);
    } catch (err) {
      setMembers(previous);
      setError(err instanceof Error ? err.message : 'Falha ao mover o servidor.');
    }
  };

  const remove = async (group: ManagerGroup) => {
    if (
      !window.confirm(
        `Remover a turma "${group.name}"? Os servidores continuam na prefeitura, ` +
          'apenas ficam sem turma.'
      )
    ) {
      return;
    }
    try {
      await deleteGroup(group.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover a turma.');
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const students = members.filter((m) => m.role === 'ALUNO');
  const field =
    'px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm ' +
    'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Turmas por secretaria</h2>
          <p className="text-slate-500 text-sm">
            {students.length} servidores · {groups.length} turmas
          </p>
        </div>
        <form onSubmit={submitNew} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Secretaria de Educação"
            className={`${field} w-56`}
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Criar turma
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {ungrouped > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-amber-200 font-semibold">
              {ungrouped} servidor(es) sem turma
            </p>
            <p className="text-slate-400 mt-0.5">
              Eles estudam normalmente, mas não aparecem nos relatórios por
              secretaria.
            </p>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-1">Nenhuma turma criada.</p>
          <p className="text-slate-600 text-sm">
            Crie uma turma por secretaria para acompanhar cada área em separado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groups.map((group) => {
            const groupMembers = students.filter((m) => m.groupId === group.id);
            return (
              <div
                key={group.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="text-white font-bold">{group.name}</h3>
                    <p className="text-slate-500 text-sm">
                      {groupMembers.length} servidores
                      {group.stats?.activeMembers30d !== undefined &&
                        ` · ${group.stats.activeMembers30d} ativos em 30 dias`}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(group)}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    aria-label={`Remover ${group.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {groupMembers.length === 0 ? (
                  <p className="text-slate-600 text-sm">
                    Nenhum servidor nesta turma ainda.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {groupMembers.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-slate-300 truncate">{m.email}</span>
                        <button
                          onClick={() => move(m, null)}
                          className="text-xs text-slate-600 hover:text-amber-400 transition-colors shrink-0"
                        >
                          tirar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Servidores sem turma: a fila de trabalho do gestor. */}
      {students.some((m) => !m.groupId) && groups.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-slate-400" />
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">
              Sem turma
            </h3>
          </div>
          <ul className="space-y-2">
            {students
              .filter((m) => !m.groupId)
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3">
                  <span className="text-slate-300 text-sm truncate">{m.email}</span>
                  <select
                    defaultValue=""
                    onChange={(e) => e.target.value && move(m, e.target.value)}
                    className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                  >
                    <option value="" className="bg-slate-900">
                      Atribuir a...
                    </option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id} className="bg-slate-900">
                        {g.name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default GroupsPanel;
