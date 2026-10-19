import { conflictError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { cell } from '../cell';
import { globalDB, type PublicMcpServerStatus } from '../db';

let isUniqueViolation = (err: unknown) =>
  !!err && typeof err === 'object' && 'code' in err && (err as any).code === 'P2002';

let slugTakenError = () =>
  new ServiceError(
    conflictError({
      message: 'This slug is already taken by another public MCP server.',
      code: 'public_mcp_slug_taken'
    })
  );

class PublicMcpServerRepository {
  async reserve(d: { id: string; slug: string; organizationId: string; instanceId: string }) {
    let currentCell = await cell;

    try {
      return await globalDB.publicMcpServer.create({
        data: {
          id: d.id,
          slug: d.slug,
          status: 'active',
          ownerOid: currentCell.oid,
          organizationId: d.organizationId,
          instanceId: d.instanceId
        }
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw slugTakenError();
      throw err;
    }
  }

  async release(d: { id: string }) {
    await globalDB.publicMcpServer.deleteMany({ where: { id: d.id } });
  }

  async rename(d: { id: string; slug: string }) {
    try {
      return await globalDB.publicMcpServer.update({
        where: { id: d.id },
        data: { slug: d.slug }
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw slugTakenError();
      throw err;
    }
  }

  async setStatus(d: { id: string; status: PublicMcpServerStatus }) {
    await globalDB.publicMcpServer.updateMany({
      where: { id: d.id },
      data: { status: d.status }
    });
  }

  async isSlugAvailable(d: { slug: string }) {
    let existing = await globalDB.publicMcpServer.findUnique({ where: { slug: d.slug } });
    return !existing;
  }

  async resolveSlug(d: { slug: string }) {
    return await globalDB.publicMcpServer.findUnique({
      where: { slug: d.slug },
      include: { owner: true }
    });
  }
}

export let publicMcpServerRepository = Service.create(
  'publicMcpServerRepository',
  () => new PublicMcpServerRepository()
).build();
