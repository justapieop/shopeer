import { Category } from "@shopeer/domain";
import type { CategoryRepository, RepositorySet, UnitOfWork } from "./ports.js";

export class CategoryUseCase {
    public constructor(
        private readonly unitOfWork: UnitOfWork<Pick<RepositorySet, "categories">>,
        private readonly categoryRepository: CategoryRepository,
    ) {}

    public async save(category: Category): Promise<Category> {
        return this.unitOfWork.execute(async ({ categories }) => categories.save(category));
    }

    public async fetchCategoryById(
        categoryId: string,
    ): Promise<Category | null> {
        return await this.categoryRepository.fetchCategoryById(categoryId);
    }

    public async fetchAllCategories(): Promise<Category[]> {
        return await this.categoryRepository.fetchAllCategories();
    }
}
