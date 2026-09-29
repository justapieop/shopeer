import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Category } from "@shopeer/domain";
import type { CategoryRepository } from "@shopeer/case";
import { Column, Entity, PrimaryColumn, Repository } from "typeorm";

@Entity({
  name: "categories",
})
export class CategoryEntity {
  @PrimaryColumn({ type: "text", })
  public readonly id!: string;

  @Column({ type: "text", unique: true, })
  public readonly name!: string;
}

@Injectable()
export class TypeOrmCategoryRepository implements CategoryRepository {
  public constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
  ) { }

  public async save(category: Category): Promise<Category> {
    return toDomain(await this.categoryRepository.save(toEntity(category)));
  }

  public async fetchCategoryById(categoryId: string): Promise<Category | null> {
    const entity: CategoryEntity | null = await this.categoryRepository.findOneBy({ id: categoryId, });
    return entity ? toDomain(entity) : null;
  }

  public async fetchAllCategories(): Promise<Category[]> {
    const entities: CategoryEntity[] = await this.categoryRepository.find({ order: { name: "ASC", }, });
    return entities.map(toDomain);
  }
}

function toDomain(entity: CategoryEntity): Category {
  return new Category({
    categoryId: entity.id,
    name: entity.name,
  });
}

function toEntity(category: Category): CategoryEntity {
  return Object.assign(new CategoryEntity(), {
    id: category.categoryId,
    name: category.name,
  });
}
