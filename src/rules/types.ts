import { Context, Bool } from "z3-solver";
import { BoardVariable } from "../states";

// ルールの基底インターフェース

export interface Rule {
  id: string;
  name: string;
  description: string;
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ): Bool<T>[];
}
